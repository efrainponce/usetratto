-- Default channel: #general for every item
-- 1) Revert prior rename (General → Actualizaciones)
UPDATE item_channels
   SET name = 'General'
 WHERE type = 'internal'
   AND name = 'Actualizaciones';

-- 2) Backfill: any item without an internal channel gets a #general at position 0
INSERT INTO item_channels (workspace_id, item_id, name, type, position)
SELECT i.workspace_id, i.id, 'General', 'internal', 0
  FROM items i
 WHERE NOT EXISTS (
   SELECT 1
     FROM item_channels c
    WHERE c.item_id = i.id
      AND c.type    = 'internal'
 );
