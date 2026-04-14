-- Add view_id to sub_item_columns for per-view column isolation.
-- Each native sub-item view has its own set of columns.

ALTER TABLE sub_item_columns
  ADD COLUMN IF NOT EXISTS view_id uuid REFERENCES sub_item_views(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sub_item_columns_view_id_idx ON sub_item_columns(view_id);

-- Assign existing source-mapped columns (created via SourceColumnMapper)
-- to the first native view on the board that has a source_board_id in config.
UPDATE sub_item_columns sic
SET view_id = (
  SELECT id FROM sub_item_views
  WHERE board_id = sic.board_id
    AND type = 'native'
    AND config ? 'source_board_id'
    AND config->>'source_board_id' IS NOT NULL
  ORDER BY position
  LIMIT 1
)
WHERE source_col_key IS NOT NULL
  AND view_id IS NULL;

-- Assign existing manual columns (source_col_key IS NULL)
-- to the first native view on the board WITHOUT a source_board_id.
UPDATE sub_item_columns sic
SET view_id = (
  SELECT id FROM sub_item_views
  WHERE board_id = sic.board_id
    AND type = 'native'
    AND (NOT (config ? 'source_board_id') OR config->>'source_board_id' IS NULL)
  ORDER BY position
  LIMIT 1
)
WHERE source_col_key IS NULL
  AND view_id IS NULL;
