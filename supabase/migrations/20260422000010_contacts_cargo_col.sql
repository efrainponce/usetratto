-- Agrega la columna `cargo` (text) al board de Contactos de TODOS los workspaces
-- existentes. Idempotente: skip si ya existe.

DO $$
DECLARE
  r RECORD;
  max_pos INT;
BEGIN
  FOR r IN
    SELECT id AS board_id
    FROM boards
    WHERE system_key = 'contacts'
  LOOP
    -- Skip si ya existe
    IF EXISTS (
      SELECT 1 FROM board_columns
      WHERE board_id = r.board_id AND col_key = 'cargo'
    ) THEN
      CONTINUE;
    END IF;

    -- Posición: 1 (después de name), corriendo las siguientes +1 para no colisionar
    UPDATE board_columns
    SET position = position + 1
    WHERE board_id = r.board_id AND position >= 1;

    INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
    VALUES (r.board_id, 'cargo', 'Cargo', 'text', 1, true, '{}'::jsonb);
  END LOOP;
END $$;
