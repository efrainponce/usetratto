-- Fase 19: Filter / Sort / Group per view
-- Add jsonb `config` column to board_views to persist view-scoped filters, sort, group_by.

ALTER TABLE board_views
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
