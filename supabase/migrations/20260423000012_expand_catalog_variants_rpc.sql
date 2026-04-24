-- ═══════════════════════════════════════════════════════════════════════════════
-- expand_catalog_variants — turn a CSV list of tallas/colores into sub_items
-- ═══════════════════════════════════════════════════════════════════════════════
-- Takes a catalog item + two booleans (use_tallas, use_colores) and generates
-- the cartesian product as sub_items in the item's Variantes view.
-- Idempotent: existing variants (matching talla+color tuple) are preserved.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION expand_catalog_variants(
  p_catalog_item_id uuid,
  p_use_tallas boolean DEFAULT true,
  p_use_colores boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id uuid;
  v_board_id     uuid;
  v_view_id      uuid;

  v_tallas_col_id uuid;
  v_colores_col_id uuid;
  v_talla_sic_id uuid;
  v_color_sic_id uuid;

  v_tallas_raw  text;
  v_colores_raw text;
  v_tallas  text[];
  v_colores text[];

  v_talla  text;
  v_color  text;
  v_name   text;
  v_position int := 0;
  v_max_position int;
  v_created int := 0;
  v_skipped int := 0;
  v_new_id uuid;
BEGIN
  -- Resolve context
  SELECT workspace_id, board_id INTO v_workspace_id, v_board_id
  FROM items WHERE id = p_catalog_item_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Catalog item % not found', p_catalog_item_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM boards WHERE id = v_board_id AND system_key = 'catalog') THEN
    RAISE EXCEPTION 'Item is not in a catalog board';
  END IF;

  SELECT id INTO v_view_id
  FROM sub_item_views
  WHERE board_id = v_board_id AND type = 'native' AND name = 'Variantes'
  LIMIT 1;

  IF v_view_id IS NULL THEN
    RAISE EXCEPTION 'Catalog board has no Variantes view';
  END IF;

  -- Resolve source columns (tallas/colores on catalog board)
  SELECT id INTO v_tallas_col_id FROM board_columns WHERE board_id = v_board_id AND col_key = 'tallas';
  SELECT id INTO v_colores_col_id FROM board_columns WHERE board_id = v_board_id AND col_key = 'colores_disponibles';

  -- Resolve destination sub_item_columns (talla/color on Variantes view)
  SELECT id INTO v_talla_sic_id FROM sub_item_columns WHERE view_id = v_view_id AND col_key = 'talla';
  SELECT id INTO v_color_sic_id FROM sub_item_columns WHERE view_id = v_view_id AND col_key = 'color';

  -- Read the CSV lists
  IF p_use_tallas AND v_tallas_col_id IS NOT NULL THEN
    SELECT value_text INTO v_tallas_raw FROM item_values WHERE item_id = p_catalog_item_id AND column_id = v_tallas_col_id;
  END IF;

  IF p_use_colores AND v_colores_col_id IS NOT NULL THEN
    SELECT value_text INTO v_colores_raw FROM item_values WHERE item_id = p_catalog_item_id AND column_id = v_colores_col_id;
  END IF;

  -- Parse (trim each token, drop empties)
  v_tallas  := CASE WHEN p_use_tallas  AND v_tallas_raw  IS NOT NULL
                    THEN ARRAY(SELECT trim(t) FROM unnest(string_to_array(v_tallas_raw, ',')) t WHERE trim(t) <> '')
                    ELSE ARRAY[NULL::text] END;
  v_colores := CASE WHEN p_use_colores AND v_colores_raw IS NOT NULL
                    THEN ARRAY(SELECT trim(c) FROM unnest(string_to_array(v_colores_raw, ',')) c WHERE trim(c) <> '')
                    ELSE ARRAY[NULL::text] END;

  IF array_length(v_tallas, 1) IS NULL OR array_length(v_colores, 1) IS NULL THEN
    RETURN jsonb_build_object('created', 0, 'skipped', 0, 'error', 'Nada que expandir — listas vacías');
  END IF;

  -- Find max existing position to append after
  SELECT COALESCE(MAX(position), -1) INTO v_max_position
  FROM sub_items WHERE item_id = p_catalog_item_id AND view_id = v_view_id;

  v_position := v_max_position + 1;

  FOREACH v_talla IN ARRAY v_tallas LOOP
    FOREACH v_color IN ARRAY v_colores LOOP
      -- Build a display name from the parts that exist
      v_name := NULLIF(concat_ws(' — ', v_talla, v_color), '');
      IF v_name IS NULL THEN CONTINUE; END IF;

      -- Check if this combo already exists (idempotency)
      IF EXISTS (
        SELECT 1
        FROM sub_items s
        LEFT JOIN sub_item_values sv_t ON sv_t.sub_item_id = s.id AND sv_t.column_id = v_talla_sic_id
        LEFT JOIN sub_item_values sv_c ON sv_c.sub_item_id = s.id AND sv_c.column_id = v_color_sic_id
        WHERE s.item_id = p_catalog_item_id
          AND s.view_id = v_view_id
          AND COALESCE(sv_t.value_text, '') = COALESCE(v_talla, '')
          AND COALESCE(sv_c.value_text, '') = COALESCE(v_color, '')
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO sub_items (workspace_id, item_id, view_id, parent_id, depth, name, position)
      VALUES (v_workspace_id, p_catalog_item_id, v_view_id, NULL, 0, v_name, v_position)
      RETURNING id INTO v_new_id;

      IF v_talla IS NOT NULL AND v_talla_sic_id IS NOT NULL THEN
        INSERT INTO sub_item_values (sub_item_id, column_id, value_text)
        VALUES (v_new_id, v_talla_sic_id, v_talla);
      END IF;

      IF v_color IS NOT NULL AND v_color_sic_id IS NOT NULL THEN
        INSERT INTO sub_item_values (sub_item_id, column_id, value_text)
        VALUES (v_new_id, v_color_sic_id, v_color);
      END IF;

      v_created := v_created + 1;
      v_position := v_position + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped);
END;
$$;

GRANT EXECUTE ON FUNCTION expand_catalog_variants(uuid, boolean, boolean) TO authenticated;
