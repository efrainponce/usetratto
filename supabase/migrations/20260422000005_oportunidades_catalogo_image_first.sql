-- ---------------------------------------------------------------------------
-- Oportunidades catálogo por defecto: foto como imagen + primera columna
-- ---------------------------------------------------------------------------
-- Convierte la columna `foto` (file) a kind `image` y la mueve a la posición 1
-- en el board Catálogo y en el sub_item_view "Catálogo" de Oportunidades.
-- Mantiene el resto del orden relativo.
--
-- NOTA: esto solo actualiza data existente. La función setup_workspace_quotes_graph
-- sigue sembrando la versión vieja para nuevos workspaces — se actualizará en una
-- migración futura cuando valga la pena tocar esa función grande.

DO $$
DECLARE
  b_id  uuid;
  v_id  uuid;
BEGIN
  -- ── Catalog board columns ─────────────────────────────────────────────────
  FOR b_id IN SELECT id FROM boards WHERE system_key = 'catalog'
  LOOP
    UPDATE board_columns SET kind = 'image', position = 1
      WHERE board_id = b_id AND col_key = 'foto';
    UPDATE board_columns SET position = 2 WHERE board_id = b_id AND col_key = 'sku';
    UPDATE board_columns SET position = 3 WHERE board_id = b_id AND col_key = 'descripcion';
    UPDATE board_columns SET position = 4 WHERE board_id = b_id AND col_key = 'unit_price';
    UPDATE board_columns SET position = 5 WHERE board_id = b_id AND col_key = 'owner';
  END LOOP;

  -- ── Oportunidades → sub_item_view "Catálogo" → sub_item_columns ──────────
  FOR v_id IN
    SELECT v.id
    FROM sub_item_views v
    JOIN boards b ON b.id = v.board_id
    WHERE v.name = 'Catálogo' AND b.system_key = 'opportunities'
  LOOP
    UPDATE sub_item_columns SET kind = 'image', position = 1
      WHERE view_id = v_id AND col_key = 'foto';
    UPDATE sub_item_columns SET position = 2
      WHERE view_id = v_id AND col_key = 'sku';
    UPDATE sub_item_columns SET position = 3
      WHERE view_id = v_id AND col_key = 'descripcion';
    UPDATE sub_item_columns SET position = 4
      WHERE view_id = v_id AND col_key = 'unit_price';
    UPDATE sub_item_columns SET position = 5
      WHERE view_id = v_id AND col_key = 'cantidad';
    UPDATE sub_item_columns SET position = 6
      WHERE view_id = v_id AND col_key = 'subtotal';
  END LOOP;
END $$;
