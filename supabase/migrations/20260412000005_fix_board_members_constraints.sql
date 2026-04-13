-- =============================================================================
-- 005_fix_board_members_constraints.sql
-- Quitar DEFERRABLE de board_members UNIQUE constraints
-- (DEFERRABLE impide usar ON CONFLICT y no era necesario aquí)
-- =============================================================================

ALTER TABLE board_members
  DROP CONSTRAINT IF EXISTS board_members_board_id_user_id_key,
  DROP CONSTRAINT IF EXISTS board_members_board_id_team_id_key;

ALTER TABLE board_members
  ADD CONSTRAINT board_members_board_id_user_id_key UNIQUE (board_id, user_id),
  ADD CONSTRAINT board_members_board_id_team_id_key UNIQUE (board_id, team_id);
