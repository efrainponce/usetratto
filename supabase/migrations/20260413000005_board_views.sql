-- Migration 011: Board Views

-- ─── board_views ────────────────────────────────────────────────────────────
CREATE TABLE board_views (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid           bigint      UNIQUE NOT NULL DEFAULT generate_sid(),
  board_id      uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  is_default    boolean     NOT NULL DEFAULT false,
  position      int         NOT NULL DEFAULT 0,
  created_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── board_view_columns ──────────────────────────────────────────────────────
CREATE TABLE board_view_columns (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id    uuid    NOT NULL REFERENCES board_views(id) ON DELETE CASCADE,
  column_id  uuid    NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  position   int     NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  width      int     NOT NULL DEFAULT 200,
  UNIQUE(view_id, column_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_board_views_board_id     ON board_views(board_id);
CREATE INDEX idx_board_views_workspace_id ON board_views(workspace_id);
CREATE INDEX idx_board_view_columns_view  ON board_view_columns(view_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE board_views        ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_view_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON board_views
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "via_view_workspace" ON board_view_columns
  FOR ALL TO authenticated
  USING (view_id IN (
    SELECT id FROM board_views
    WHERE workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  ));
