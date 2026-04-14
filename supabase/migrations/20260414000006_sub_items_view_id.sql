-- Migration: add view_id to sub_items so each sub-item belongs to a specific sub_item_view.
-- Nullable for backward compatibility — existing sub-items keep view_id = NULL.
-- New sub-items created through the UI will always have view_id set.

ALTER TABLE sub_items
  ADD COLUMN IF NOT EXISTS view_id uuid REFERENCES sub_item_views(id) ON DELETE SET NULL;

-- Index for the filter we add in nativeHandler
CREATE INDEX IF NOT EXISTS sub_items_view_id_idx ON sub_items (view_id);
