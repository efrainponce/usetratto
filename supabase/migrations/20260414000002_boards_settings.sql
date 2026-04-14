-- Migration: boards.settings jsonb — variant_dimensions, subitem_view, etc.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';
