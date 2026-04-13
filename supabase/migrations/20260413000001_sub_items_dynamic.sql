-- Fase 5: Dynamic sub_items architecture
-- Introduces sub_item_columns table, removes sub_item_views, refactors sub_items schema

-- 1. Add sub_items_source_board_id column to boards
ALTER TABLE boards ADD COLUMN sub_items_source_board_id uuid REFERENCES boards(id) ON DELETE SET NULL;

-- 2. Create sub_item_columns table
CREATE TABLE sub_item_columns (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id       uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  col_key        text        NOT NULL,
  name           text        NOT NULL,
  kind           text        NOT NULL DEFAULT 'text'
                             CHECK (kind IN ('text','number','date','select','multiselect',
                                             'people','boolean','url','file','email',
                                             'phone','autonumber','formula','relation')),
  position       int         NOT NULL DEFAULT 0,
  is_hidden      boolean     NOT NULL DEFAULT false,
  required       boolean     NOT NULL DEFAULT false,
  settings       jsonb       NOT NULL DEFAULT '{}',
  source_col_key text,
  UNIQUE (board_id, col_key)
);

-- 3. Fix sub_item_values foreign key to reference sub_item_columns
TRUNCATE sub_item_values CASCADE;

ALTER TABLE sub_item_values DROP CONSTRAINT sub_item_values_column_id_fkey;

ALTER TABLE sub_item_values ADD CONSTRAINT sub_item_values_column_id_fkey
  FOREIGN KEY (column_id) REFERENCES sub_item_columns(id) ON DELETE CASCADE;

-- 4. Alter sub_items: drop legacy columns, add source_item_id
ALTER TABLE sub_items
  DROP COLUMN qty,
  DROP COLUMN unit_price,
  DROP COLUMN notes,
  DROP COLUMN catalog_item_id;

ALTER TABLE sub_items
  ADD COLUMN source_item_id uuid REFERENCES items(id) ON DELETE SET NULL;

-- 5. Drop sub_item_views
DROP TABLE IF EXISTS sub_item_views CASCADE;

-- 6. Enable RLS on sub_item_columns and add policies
ALTER TABLE sub_item_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY sub_item_columns_select ON sub_item_columns FOR SELECT
  USING (board_id IN (
    SELECT id FROM boards WHERE workspace_id = auth_workspace_id()
  ));

CREATE POLICY sub_item_columns_modify ON sub_item_columns FOR ALL
  USING (board_id IN (
    SELECT id FROM boards WHERE workspace_id = auth_workspace_id()
  ));
