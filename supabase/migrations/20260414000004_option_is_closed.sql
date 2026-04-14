-- Migration: Add is_closed flag to terminated/delivered options
-- Date: 2026-04-14

-- 1. Update sub_item_columns: add is_closed to Terminado and Entregado options
UPDATE sub_item_columns
SET settings = jsonb_set(
  settings,
  '{options}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN opt->>'value' IN ('Terminado', 'Entregado')
        THEN opt || '{"is_closed": true}'
        ELSE opt
      END
    )
    FROM jsonb_array_elements(settings->'options') AS opt
  )
)
WHERE board_id IN (SELECT id FROM boards WHERE system_key = 'opportunities')
  AND col_key = 'estado'
  AND settings->'options' IS NOT NULL;

-- 2. Remove closed_sub_values key from boards.settings
UPDATE boards
SET settings = settings - 'closed_sub_values'
WHERE system_key = 'opportunities';
