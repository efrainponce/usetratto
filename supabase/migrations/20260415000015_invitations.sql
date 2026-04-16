-- Fase 17.1 — Invitations table for email-based onboarding

CREATE TABLE invitations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid          bigint      UNIQUE DEFAULT generate_sid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  role         text        NOT NULL CHECK (role IN ('admin','member','viewer')),
  token        text        NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  created_by   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX invitations_workspace_id_idx ON invitations(workspace_id);
CREATE INDEX invitations_token_idx ON invitations(token);
CREATE INDEX invitations_email_idx ON invitations(workspace_id, email);

-- Partial unique constraint: prevent two pending invitations for the same (workspace_id, lower(email))
CREATE UNIQUE INDEX invitations_pending_unique ON invitations (workspace_id, lower(email)) WHERE accepted_at IS NULL;

-- RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_workspace_isolation" ON invitations
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "invitations_admin_write" ON invitations
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND workspace_id = invitations.workspace_id
        AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "invitations_admin_update" ON invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND workspace_id = invitations.workspace_id
        AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND workspace_id = invitations.workspace_id
        AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "invitations_admin_delete" ON invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND workspace_id = invitations.workspace_id
        AND role IN ('admin', 'superadmin')
    )
  );
