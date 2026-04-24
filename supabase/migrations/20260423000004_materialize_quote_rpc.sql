-- ═══════════════════════════════════════════════════════════════════════════════
-- materialize_quote_from_opportunity
-- ═══════════════════════════════════════════════════════════════════════════════
-- Atomically creates an immutable quote snapshot from an opportunity:
--   1. Creates a new item in the workspace's Cotizaciones board (system_key='quotes').
--   2. Copies the opp's Catálogo sub_items (L1 + L2 variants) into the new quote's
--      Partidas view as raw, detached rows.
--   3. Copies relation values (contacto, institucion) from the opp.
--   4. Computes and stores the quote's total (monto).
--
-- After this runs, the opp's Catálogo is still mutable by sales; the quote is
-- the stable object owned by compras. If sales needs a new costing, the caller
-- materializes again → a new quote item exists (version handled later via
-- `supersedes` column if we add it).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION materialize_quote_from_opportunity(
  p_opp_item_id uuid,
  p_actor_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id     uuid;
  v_opp_board_id     uuid;
  v_opp_name         text;
  v_opp_owner_id     uuid;

  v_quotes_board_id  uuid;
  v_catalog_board_id uuid;

  v_quote_item_id    uuid;
  v_quote_item_sid   bigint;
  v_quote_stage_id   uuid;

  v_partidas_view_id uuid;
  v_catalogo_view_id uuid;

  v_col_oportunidad  uuid;
  v_col_contacto     uuid;
  v_col_institucion  uuid;
  v_col_generated_by uuid;
  v_col_monto        uuid;

  v_opp_contacto_col_id   uuid;
  v_contact_institucion_col_id uuid;
  v_contacto_value   text;
  v_institucion_value text;

  v_monto_total      numeric := 0;

  v_new_sub_item_id  uuid;
  r_sub              record;
BEGIN
  -- ── 1. Resolve the opp + workspace context ────────────────────────────────

  SELECT i.workspace_id, i.board_id, i.name, i.owner_id
  INTO   v_workspace_id, v_opp_board_id, v_opp_name, v_opp_owner_id
  FROM items i
  WHERE i.id = p_opp_item_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity % not found', p_opp_item_id;
  END IF;

  -- Guard: source must be an opportunities board
  IF NOT EXISTS (
    SELECT 1 FROM boards WHERE id = v_opp_board_id AND system_key = 'opportunities'
  ) THEN
    RAISE EXCEPTION 'Source item is not in an opportunities board';
  END IF;

  -- ── 2. Resolve the target Cotizaciones board + its Partidas view ──────────

  SELECT id INTO v_quotes_board_id
  FROM boards
  WHERE workspace_id = v_workspace_id AND system_key = 'quotes'
  LIMIT 1;

  IF v_quotes_board_id IS NULL THEN
    RAISE EXCEPTION 'Workspace has no quotes board';
  END IF;

  SELECT id INTO v_catalog_board_id
  FROM boards
  WHERE workspace_id = v_workspace_id AND system_key = 'catalog'
  LIMIT 1;

  SELECT id INTO v_partidas_view_id
  FROM sub_item_views
  WHERE board_id = v_quotes_board_id AND type = 'native' AND name = 'Partidas'
  ORDER BY position
  LIMIT 1;

  IF v_partidas_view_id IS NULL THEN
    RAISE EXCEPTION 'Cotizaciones board has no Partidas view';
  END IF;

  -- Opp's Catálogo view = native view whose source_board_id points to the catalog
  SELECT id INTO v_catalogo_view_id
  FROM sub_item_views
  WHERE board_id = v_opp_board_id
    AND type = 'native'
    AND (config->>'source_board_id')::uuid = v_catalog_board_id
  ORDER BY position
  LIMIT 1;

  -- ── 3. First stage on Cotizaciones (Borrador) ────────────────────────────

  SELECT id INTO v_quote_stage_id
  FROM board_stages
  WHERE board_id = v_quotes_board_id
  ORDER BY position
  LIMIT 1;

  -- ── 4. Resolve quote board columns we need to set ─────────────────────────

  SELECT id INTO v_col_oportunidad  FROM board_columns WHERE board_id = v_quotes_board_id AND col_key = 'oportunidad';
  SELECT id INTO v_col_contacto     FROM board_columns WHERE board_id = v_quotes_board_id AND col_key = 'contacto';
  SELECT id INTO v_col_institucion  FROM board_columns WHERE board_id = v_quotes_board_id AND col_key = 'institucion';
  SELECT id INTO v_col_generated_by FROM board_columns WHERE board_id = v_quotes_board_id AND col_key = 'generated_by';
  SELECT id INTO v_col_monto        FROM board_columns WHERE board_id = v_quotes_board_id AND col_key = 'monto';

  -- ── 5. Pull opp's contacto value and (two hops) institucion ───────────────

  SELECT id INTO v_opp_contacto_col_id
  FROM board_columns
  WHERE board_id = v_opp_board_id AND col_key = 'contacto';

  IF v_opp_contacto_col_id IS NOT NULL THEN
    SELECT value_text INTO v_contacto_value
    FROM item_values
    WHERE item_id = p_opp_item_id AND column_id = v_opp_contacto_col_id;
  END IF;

  IF v_contacto_value IS NOT NULL THEN
    SELECT bc.id INTO v_contact_institucion_col_id
    FROM board_columns bc
    JOIN items contact_item ON contact_item.id = v_contacto_value::uuid
    WHERE bc.board_id = contact_item.board_id AND bc.col_key = 'institucion';

    IF v_contact_institucion_col_id IS NOT NULL THEN
      SELECT value_text INTO v_institucion_value
      FROM item_values
      WHERE item_id = v_contacto_value::uuid AND column_id = v_contact_institucion_col_id;
    END IF;
  END IF;

  -- ── 6. Create the quote item ──────────────────────────────────────────────

  INSERT INTO items (workspace_id, board_id, stage_id, name, owner_id)
  VALUES (
    v_workspace_id,
    v_quotes_board_id,
    v_quote_stage_id,
    'Cotización — ' || COALESCE(NULLIF(v_opp_name, ''), 'Oportunidad'),
    COALESCE(p_actor_id, v_opp_owner_id)
  )
  RETURNING id, sid INTO v_quote_item_id, v_quote_item_sid;

  -- Relations + metadata
  IF v_col_oportunidad IS NOT NULL THEN
    INSERT INTO item_values (item_id, column_id, value_text)
    VALUES (v_quote_item_id, v_col_oportunidad, p_opp_item_id::text);
  END IF;

  IF v_col_contacto IS NOT NULL AND v_contacto_value IS NOT NULL THEN
    INSERT INTO item_values (item_id, column_id, value_text)
    VALUES (v_quote_item_id, v_col_contacto, v_contacto_value);
  END IF;

  IF v_col_institucion IS NOT NULL AND v_institucion_value IS NOT NULL THEN
    INSERT INTO item_values (item_id, column_id, value_text)
    VALUES (v_quote_item_id, v_col_institucion, v_institucion_value);
  END IF;

  IF v_col_generated_by IS NOT NULL AND p_actor_id IS NOT NULL THEN
    INSERT INTO item_values (item_id, column_id, value_text)
    VALUES (v_quote_item_id, v_col_generated_by, p_actor_id::text);
  END IF;

  -- ── 7. Copy sub_items (L1 + L2) from opp's Catálogo into quote's Partidas ─

  -- Only copy if the opp has a Catálogo view (otherwise skip — empty quote)
  IF v_catalogo_view_id IS NOT NULL THEN

    -- Map: src_col_key → dst_col_id (in Partidas view)
    -- We use col_key as the bridge since sub_item_columns uses UNIQUE(board_id, col_key)
    -- and both views share the same semantic col_keys (sku, descripcion, foto, unit_price, cantidad, subtotal).

    -- Temp mapping of old_sub_item_id → new_sub_item_id (for parent remapping)
    CREATE TEMP TABLE IF NOT EXISTS _sub_item_map (
      old_id uuid PRIMARY KEY,
      new_id uuid NOT NULL
    ) ON COMMIT DROP;
    TRUNCATE _sub_item_map;

    -- Pass 1: L1 sub-items (depth = 0)
    FOR r_sub IN
      SELECT id, name, position, source_item_id
      FROM sub_items
      WHERE item_id = p_opp_item_id
        AND view_id = v_catalogo_view_id
        AND depth = 0
      ORDER BY position
    LOOP
      INSERT INTO sub_items (workspace_id, item_id, view_id, parent_id, depth, name, position, source_item_id)
      VALUES (v_workspace_id, v_quote_item_id, v_partidas_view_id, NULL, 0, r_sub.name, r_sub.position, r_sub.source_item_id)
      RETURNING id INTO v_new_sub_item_id;

      INSERT INTO _sub_item_map (old_id, new_id) VALUES (r_sub.id, v_new_sub_item_id);

      -- Copy values: translate source sub_item_column_id → destination by matching col_key
      INSERT INTO sub_item_values (sub_item_id, column_id, value_text, value_number, value_date, value_json)
      SELECT
        v_new_sub_item_id,
        dst.id,
        siv.value_text,
        siv.value_number,
        siv.value_date,
        siv.value_json
      FROM sub_item_values siv
      JOIN sub_item_columns src ON src.id = siv.column_id
      JOIN sub_item_columns dst ON dst.board_id = v_quotes_board_id
                                AND dst.view_id  = v_partidas_view_id
                                AND dst.col_key  = src.col_key
      WHERE siv.sub_item_id = r_sub.id;
    END LOOP;

    -- Pass 2: L2 variants (depth = 1) — parent_id remapped via _sub_item_map
    FOR r_sub IN
      SELECT s.id, s.name, s.position, s.source_item_id, s.parent_id
      FROM sub_items s
      WHERE s.item_id = p_opp_item_id
        AND s.view_id = v_catalogo_view_id
        AND s.depth = 1
      ORDER BY s.position
    LOOP
      INSERT INTO sub_items (workspace_id, item_id, view_id, parent_id, depth, name, position, source_item_id)
      VALUES (
        v_workspace_id,
        v_quote_item_id,
        v_partidas_view_id,
        (SELECT new_id FROM _sub_item_map WHERE old_id = r_sub.parent_id),
        1,
        r_sub.name,
        r_sub.position,
        r_sub.source_item_id
      )
      RETURNING id INTO v_new_sub_item_id;

      INSERT INTO _sub_item_map (old_id, new_id) VALUES (r_sub.id, v_new_sub_item_id);

      INSERT INTO sub_item_values (sub_item_id, column_id, value_text, value_number, value_date, value_json)
      SELECT
        v_new_sub_item_id,
        dst.id,
        siv.value_text,
        siv.value_number,
        siv.value_date,
        siv.value_json
      FROM sub_item_values siv
      JOIN sub_item_columns src ON src.id = siv.column_id
      JOIN sub_item_columns dst ON dst.board_id = v_quotes_board_id
                                AND dst.view_id  = v_partidas_view_id
                                AND dst.col_key  = src.col_key
      WHERE siv.sub_item_id = r_sub.id;
    END LOOP;

    -- ── 8. Compute and store quote total (sum of L1 cantidad * unit_price) ─

    SELECT COALESCE(SUM(
      COALESCE((
        SELECT siv.value_number FROM sub_item_values siv
        JOIN sub_item_columns c ON c.id = siv.column_id
        WHERE siv.sub_item_id = s.id AND c.col_key = 'cantidad'
      ), 0)
      *
      COALESCE((
        SELECT siv.value_number FROM sub_item_values siv
        JOIN sub_item_columns c ON c.id = siv.column_id
        WHERE siv.sub_item_id = s.id AND c.col_key = 'unit_price'
      ), 0)
    ), 0)
    INTO v_monto_total
    FROM sub_items s
    WHERE s.item_id = v_quote_item_id AND s.depth = 0;

    IF v_col_monto IS NOT NULL THEN
      INSERT INTO item_values (item_id, column_id, value_number)
      VALUES (v_quote_item_id, v_col_monto, v_monto_total)
      ON CONFLICT (item_id, column_id) DO UPDATE SET value_number = EXCLUDED.value_number;
    END IF;

  END IF;

  RETURN jsonb_build_object(
    'quote_id',  v_quote_item_id,
    'quote_sid', v_quote_item_sid,
    'monto',     v_monto_total
  );
END;
$$;

-- Allow calling from any authenticated user; RLS on the API layer gates who can trigger.
GRANT EXECUTE ON FUNCTION materialize_quote_from_opportunity(uuid, uuid) TO authenticated;
