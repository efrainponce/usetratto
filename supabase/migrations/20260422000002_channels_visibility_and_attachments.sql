-- ---------------------------------------------------------------------------
-- Channels: public/private visibility + message attachments
-- ---------------------------------------------------------------------------

-- 1) Visibility column on item_channels
ALTER TABLE item_channels
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','private'));

CREATE INDEX IF NOT EXISTS item_channels_visibility_idx ON item_channels(visibility);

-- 2) Attachments table (one row per file attached to a message)
CREATE TABLE IF NOT EXISTS channel_message_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id   uuid        NOT NULL REFERENCES channel_messages(id) ON DELETE CASCADE,
  file_path    text        NOT NULL,
  file_name    text        NOT NULL,
  mime_type    text        NOT NULL,
  size_bytes   bigint      NOT NULL,
  uploaded_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_message_attachments_message_idx
  ON channel_message_attachments(message_id);

ALTER TABLE channel_message_attachments ENABLE ROW LEVEL SECURITY;

-- 3) RLS: private channels are visible only to members (admins bypass)
DROP POLICY IF EXISTS item_channels_select ON item_channels;
CREATE POLICY item_channels_select ON item_channels FOR SELECT
  USING (
    workspace_id = auth_workspace_id()
    AND (
      visibility = 'public'
      OR auth_is_admin()
      OR id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS channel_messages_select ON channel_messages;
CREATE POLICY channel_messages_select ON channel_messages FOR SELECT
  USING (
    workspace_id = auth_workspace_id()
    AND channel_id IN (
      SELECT id FROM item_channels
      WHERE workspace_id = auth_workspace_id()
        AND (
          visibility = 'public'
          OR auth_is_admin()
          OR id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS channel_messages_insert ON channel_messages;
CREATE POLICY channel_messages_insert ON channel_messages FOR INSERT
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND channel_id IN (
      SELECT id FROM item_channels
      WHERE workspace_id = auth_workspace_id()
        AND (
          visibility = 'public'
          OR auth_is_admin()
          OR id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
        )
    )
  );

-- Attachments inherit message visibility
CREATE POLICY channel_message_attachments_select ON channel_message_attachments FOR SELECT
  USING (
    workspace_id = auth_workspace_id()
    AND message_id IN (
      SELECT m.id FROM channel_messages m
      JOIN item_channels c ON c.id = m.channel_id
      WHERE m.workspace_id = auth_workspace_id()
        AND (
          c.visibility = 'public'
          OR auth_is_admin()
          OR c.id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
        )
    )
  );

CREATE POLICY channel_message_attachments_insert ON channel_message_attachments FOR INSERT
  WITH CHECK (workspace_id = auth_workspace_id());
