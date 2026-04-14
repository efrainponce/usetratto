-- =============================================================================
-- 009_sub_item_views.sql
-- Drop old sub_item_views and recreate with new design
-- Supports: native, board_items, board_sub_items views
-- =============================================================================

DROP TABLE IF EXISTS sub_item_views CASCADE;

CREATE TABLE sub_item_views (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid          bigint      UNIQUE DEFAULT generate_sid(),
  board_id     uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  position     int         NOT NULL DEFAULT 0,
  type         text        NOT NULL DEFAULT 'native'
                           CHECK (type IN ('native', 'board_items', 'board_sub_items')),
  config       jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sub_item_views_board_id_idx ON sub_item_views(board_id);

-- Auto-create a default native view for every existing board
INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config)
SELECT id, workspace_id, 'Sub-items', 0, 'native', '{}'
FROM boards;

-- Snapshot mode: copy sub_items_source_board_id into native view config
-- boards that had a source board keep the ProductPicker / snapshot behavior
UPDATE sub_item_views siv
SET config = jsonb_build_object('source_board_id', b.sub_items_source_board_id)
FROM boards b
WHERE siv.board_id = b.id
  AND siv.type = 'native'
  AND b.sub_items_source_board_id IS NOT NULL;

-- RLS
ALTER TABLE sub_item_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_item_views_workspace_isolation" ON sub_item_views
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );
