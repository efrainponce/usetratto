-- ---------------------------------------------------------------------------
-- Fix RLS recursion between item_channels and channel_members
-- ---------------------------------------------------------------------------
-- 20260422000002 changed item_channels.SELECT to subquery channel_members,
-- but channel_members.SELECT already subqueries item_channels → infinite loop.
-- Wrap membership checks in SECURITY DEFINER helpers that bypass RLS.

CREATE OR REPLACE FUNCTION auth_channel_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT channel_id FROM channel_members WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS item_channels_select ON item_channels;
CREATE POLICY item_channels_select ON item_channels FOR SELECT
  USING (
    workspace_id = auth_workspace_id()
    AND (
      visibility = 'public'
      OR auth_is_admin()
      OR id IN (SELECT auth_channel_ids())
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
          OR id IN (SELECT auth_channel_ids())
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
          OR id IN (SELECT auth_channel_ids())
        )
    )
  );

DROP POLICY IF EXISTS channel_message_attachments_select ON channel_message_attachments;
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
          OR c.id IN (SELECT auth_channel_ids())
        )
    )
  );
