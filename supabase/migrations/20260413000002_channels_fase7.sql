-- Migration 008: Channels for Fase 7 (Mini Slack feature)

CREATE OR REPLACE FUNCTION create_default_channels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO item_channels (workspace_id, item_id, name, type, position)
  VALUES
    (NEW.workspace_id, NEW.id, 'Actualizaciones', 'internal', 0),
    (NEW.workspace_id, NEW.id, 'Sistema',          'system',   1);
  RETURN NEW;
END;
$$;

UPDATE item_channels SET name = 'Actualizaciones' WHERE name = 'General' AND type = 'internal';

CREATE INDEX IF NOT EXISTS item_channels_item_id_idx     ON item_channels(item_id);
CREATE INDEX IF NOT EXISTS channel_members_channel_id_idx ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS channel_members_user_id_idx    ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS mentions_mentioned_user_id_idx ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS mentions_message_id_idx        ON mentions(message_id);
CREATE INDEX IF NOT EXISTS item_activity_created_at_idx   ON item_activity(item_id, created_at DESC);
