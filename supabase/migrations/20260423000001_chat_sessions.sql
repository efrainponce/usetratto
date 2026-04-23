-- chat_sessions + chat_messages: conversaciones del Tratto AI Agent
-- Un engine, múltiples transportes (sidebar web, WhatsApp, mobile)

CREATE TABLE chat_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transport        text NOT NULL CHECK (transport IN ('sidebar','whatsapp','mobile')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, last_message_at DESC);
CREATE INDEX idx_chat_sessions_workspace ON chat_sessions(workspace_id);

CREATE TABLE chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('user','assistant','tool_result')),
  content      text NOT NULL,
  tool_calls   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at DESC);

ALTER TABLE chat_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;

-- Solo el propio user (o superadmin) ve sus sesiones
CREATE POLICY chat_sessions_select ON chat_sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
  );

CREATE POLICY chat_sessions_insert ON chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_sessions_update ON chat_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_sessions_delete ON chat_sessions FOR DELETE
  USING (user_id = auth.uid());

-- Messages: acceso heredado de la sesión
CREATE POLICY chat_messages_select ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND (
          s.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
        )
    )
  );

CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

-- Auto-update last_message_at al insertar mensaje
CREATE OR REPLACE FUNCTION touch_chat_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE chat_sessions
     SET last_message_at = NEW.created_at
   WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_chat_session
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION touch_chat_session();
