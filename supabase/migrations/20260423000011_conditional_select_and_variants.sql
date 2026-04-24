-- ═══════════════════════════════════════════════════════════════════════════════
-- `conditional_select` kind + tallas/colores in Catálogo + variantes cols
-- ═══════════════════════════════════════════════════════════════════════════════
-- New column kind: `conditional_select` — a select whose options are pulled
-- from a TEXT/multiselect value on a related item (via `source_item_id` on
-- sub_items, or via a relation column on items).
--
-- Settings shape:
--   { "source_col_key": "<col_key to read from the source item>" }
--
-- Also adds opinionated columns:
--   Catálogo board:             tallas + colores_disponibles (text, CSV)
--   Catálogo Variantes view:    talla + color (conditional_select)
--   Opp Catálogo view:          talla + color (conditional_select)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PART 1: Relax kind constraint on both tables ──────────────────────────────

ALTER TABLE board_columns
  DROP CONSTRAINT IF EXISTS board_columns_kind_check;

ALTER TABLE board_columns
  ADD CONSTRAINT board_columns_kind_check
  CHECK (kind IN (
    'text','number','date','select','multiselect',
    'people','boolean','url','file','email','phone',
    'autonumber','formula','relation',
    'button','signature','rollup','reflejo','image',
    'conditional_select'
  ));

ALTER TABLE sub_item_columns
  DROP CONSTRAINT IF EXISTS sub_item_columns_kind_check;

ALTER TABLE sub_item_columns
  ADD CONSTRAINT sub_item_columns_kind_check
  CHECK (kind IN (
    'text','number','date','select','multiselect',
    'people','boolean','url','file','email','phone',
    'autonumber','formula','relation',
    'button','signature','rollup','reflejo','image',
    'conditional_select'
  ));

-- ── PART 2: Add tallas + colores_disponibles to Catálogo boards ──────────────

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT b.id, 'tallas', 'Tallas', 'text', 9, false,
       jsonb_build_object('placeholder', 'XS,S,M,L,XL', 'is_csv_list', true)
FROM boards b
WHERE b.system_key = 'catalog'
  AND NOT EXISTS (SELECT 1 FROM board_columns bc WHERE bc.board_id = b.id AND bc.col_key = 'tallas');

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT b.id, 'colores_disponibles', 'Colores disponibles', 'text', 10, false,
       jsonb_build_object('placeholder', 'Negro,Blanco,Rojo', 'is_csv_list', true)
FROM boards b
WHERE b.system_key = 'catalog'
  AND NOT EXISTS (SELECT 1 FROM board_columns bc WHERE bc.board_id = b.id AND bc.col_key = 'colores_disponibles');

-- ── PART 3: Add talla + color to the Catálogo Variantes sub_item_view ───────

DO $$
DECLARE
  v_workspace_id uuid;
  v_catalog_id   uuid;
  v_view_id      uuid;
BEGIN
  FOR v_workspace_id, v_catalog_id IN
    SELECT workspace_id, id FROM boards WHERE system_key = 'catalog'
  LOOP
    SELECT id INTO v_view_id
    FROM sub_item_views
    WHERE board_id = v_catalog_id AND type = 'native' AND name = 'Variantes'
    LIMIT 1;

    IF v_view_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO sub_item_columns
      (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, settings)
    VALUES
      (v_catalog_id, v_view_id, 'talla', 'Talla', 'conditional_select', 1, NULL, false, false,
       jsonb_build_object('source_col_key', 'tallas')),
      (v_catalog_id, v_view_id, 'color', 'Color', 'conditional_select', 2, NULL, false, false,
       jsonb_build_object('source_col_key', 'colores_disponibles')),
      (v_catalog_id, v_view_id, 'sku_variante', 'SKU variante', 'text', 3, NULL, false, false, '{}'::jsonb)
    ON CONFLICT (board_id, col_key) DO NOTHING;
  END LOOP;
END $$;

-- ── PART 4: Add talla + color to the Opp Catálogo sub_item_view ─────────────
-- These live at L2 level (variantes per product) but the view config is shared.

DO $$
DECLARE
  v_workspace_id uuid;
  v_opp_id       uuid;
  v_catalog_id   uuid;
  v_view_id      uuid;
BEGIN
  FOR v_workspace_id, v_opp_id, v_catalog_id IN
    SELECT w.id, opp.id, cat.id
    FROM workspaces w
    JOIN boards opp ON opp.workspace_id = w.id AND opp.system_key = 'opportunities'
    JOIN boards cat ON cat.workspace_id = w.id AND cat.system_key = 'catalog'
  LOOP
    SELECT id INTO v_view_id
    FROM sub_item_views
    WHERE board_id = v_opp_id
      AND type = 'native'
      AND (config->>'source_board_id')::uuid = v_catalog_id
    LIMIT 1;

    IF v_view_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO sub_item_columns
      (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, settings)
    VALUES
      (v_opp_id, v_view_id, 'talla', 'Talla', 'conditional_select', 8, NULL, false, false,
       jsonb_build_object('source_col_key', 'tallas')),
      (v_opp_id, v_view_id, 'color', 'Color', 'conditional_select', 9, NULL, false, false,
       jsonb_build_object('source_col_key', 'colores_disponibles'))
    ON CONFLICT (board_id, col_key) DO NOTHING;
  END LOOP;
END $$;

-- ── PART 5: Add talla + color to the documentos Partidas view ────────────────

DO $$
DECLARE
  v_workspace_id uuid;
  v_docs_id      uuid;
  v_view_id      uuid;
BEGIN
  FOR v_workspace_id, v_docs_id IN
    SELECT workspace_id, id FROM boards WHERE system_key = 'documents'
  LOOP
    SELECT id INTO v_view_id
    FROM sub_item_views
    WHERE board_id = v_docs_id AND type = 'native' AND name = 'Partidas'
    LIMIT 1;

    IF v_view_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO sub_item_columns
      (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, settings)
    VALUES
      (v_docs_id, v_view_id, 'talla', 'Talla', 'conditional_select', 8, NULL, false, false,
       jsonb_build_object('source_col_key', 'tallas')),
      (v_docs_id, v_view_id, 'color', 'Color', 'conditional_select', 9, NULL, false, false,
       jsonb_build_object('source_col_key', 'colores_disponibles'))
    ON CONFLICT (board_id, col_key) DO NOTHING;
  END LOOP;
END $$;
