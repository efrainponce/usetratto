-- Enable Supabase Realtime for board_columns and board_stages
-- Required for BoardView live subscription to column/stage changes

ALTER TABLE board_columns REPLICA IDENTITY FULL;
ALTER TABLE board_stages  REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE board_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE board_stages;
