-- 17.5.1 — Indexes on frequently-queried FKs
-- These FKs are used in JOINs/WHERE across 56+ API routes but had no index.

CREATE INDEX IF NOT EXISTS idx_board_columns_board_id ON board_columns(board_id);
CREATE INDEX IF NOT EXISTS idx_board_stages_board_id ON board_stages(board_id);
CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_teams_workspace_id ON teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_territories_workspace_id ON territories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sub_item_columns_board_id ON sub_item_columns(board_id);
CREATE INDEX IF NOT EXISTS idx_column_permissions_column_id ON column_permissions(column_id);
