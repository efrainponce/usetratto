-- Migration: Add "Estado" sub-item column to opportunities boards
-- Purpose: Add status tracking for sub-items in opportunities boards
-- Date: 2026-04-14

DO $$
DECLARE
  v_board_id UUID;
  v_next_position INT;
BEGIN
  -- Loop through all boards with system_key = 'opportunities'
  FOR v_board_id IN
    SELECT id FROM boards WHERE system_key = 'opportunities'
  LOOP
    -- Calculate next position for the new column
    SELECT COALESCE(MAX(position), -1) + 1 INTO v_next_position
    FROM sub_item_columns
    WHERE board_id = v_board_id;

    -- Insert "Estado" sub-item column if it doesn't already exist
    INSERT INTO sub_item_columns (
      board_id,
      col_key,
      name,
      kind,
      position,
      is_hidden,
      required,
      source_col_key,
      settings
    )
    VALUES (
      v_board_id,
      'estado',
      'Estado',
      'select',
      v_next_position,
      false,
      false,
      NULL,
      '{
        "options": [
          {"value": "Pendiente", "color": "#6B7280"},
          {"value": "En producción", "color": "#3B82F6"},
          {"value": "Entregado", "color": "#10B981"},
          {"value": "Terminado", "color": "#8B5CF6"}
        ]
      }'::jsonb
    )
    ON CONFLICT (board_id, col_key) DO NOTHING;

    -- Update boards.settings to add status tracking config
    -- Only update if status_sub_col_key is not already set
    UPDATE boards
    SET settings = settings || '{
      "status_sub_col_key": "estado",
      "closed_sub_values": ["Terminado", "Entregado"]
    }'::jsonb
    WHERE id = v_board_id
      AND (settings->'status_sub_col_key' IS NULL);

  END LOOP;
END $$;
