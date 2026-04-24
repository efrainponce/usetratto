-- ═══════════════════════════════════════════════════════════════════════════════
-- Clean up legacy auto-created "Sub-items" views on Cotizaciones boards
-- ═══════════════════════════════════════════════════════════════════════════════
-- `getSubItemViews` auto-creates a default 'Sub-items' view when a board has
-- none (safety fallback). If a user visited the quotes board BEFORE migration
-- 003 seeded the 'Partidas' view, that fallback ran — leaving two coexisting
-- position-0 views. The UI picks the first one found and the snapshot sub_items
-- (attached to Partidas) look missing.
--
-- Safe to delete: these fallback views are always empty. But we guard by only
-- deleting views with zero sub_items.
-- ═══════════════════════════════════════════════════════════════════════════════

DELETE FROM sub_item_views siv
WHERE siv.type = 'native'
  AND siv.name = 'Sub-items'
  AND siv.board_id IN (SELECT id FROM boards WHERE system_key = 'quotes')
  AND NOT EXISTS (SELECT 1 FROM sub_items s WHERE s.view_id = siv.id);
