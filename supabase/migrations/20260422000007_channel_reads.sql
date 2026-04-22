-- channel_reads: last_read_at por (user, channel). Slack-style.
CREATE TABLE channel_reads (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES item_channels(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE INDEX idx_channel_reads_channel ON channel_reads(channel_id);

ALTER TABLE channel_reads ENABLE ROW LEVEL SECURITY;

-- Solo el propio user ve/edita sus reads
CREATE POLICY channel_reads_select ON channel_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY channel_reads_upsert ON channel_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY channel_reads_update ON channel_reads FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
