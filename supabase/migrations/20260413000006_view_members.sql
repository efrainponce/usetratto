-- Migration 012: Board View Members
-- Allows restricting who can see a specific board view.
-- Semantics: no rows for a view = visible to all board members; rows exist = only those users/teams can see it.

CREATE TABLE board_view_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id    uuid        NOT NULL REFERENCES board_views(id) ON DELETE CASCADE,
  user_id    uuid        REFERENCES users(id) ON DELETE CASCADE,
  team_id    uuid        REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT board_view_members_xor CHECK (
    (user_id IS NOT NULL AND team_id IS NULL) OR
    (user_id IS NULL   AND team_id IS NOT NULL)
  ),
  UNIQUE(view_id, user_id),
  UNIQUE(view_id, team_id)
);

CREATE INDEX idx_board_view_members_view    ON board_view_members(view_id);
CREATE INDEX idx_board_view_members_user    ON board_view_members(user_id);
CREATE INDEX idx_board_view_members_team    ON board_view_members(team_id);

ALTER TABLE board_view_members ENABLE ROW LEVEL SECURITY;

-- Any authenticated user in the workspace can read view memberships for views in their workspace
CREATE POLICY "read_board_view_members" ON board_view_members
  FOR SELECT TO authenticated
  USING (
    view_id IN (
      SELECT bv.id
      FROM board_views bv
      JOIN boards b ON b.id = bv.board_id
      WHERE b.workspace_id IN (
        SELECT workspace_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Only admins can insert/update/delete
CREATE POLICY "admin_modify_board_view_members" ON board_view_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  );
