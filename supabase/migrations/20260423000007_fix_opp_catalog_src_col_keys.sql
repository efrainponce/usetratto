-- ═══════════════════════════════════════════════════════════════════════════════
-- Normalize dynamic `src_*` col_keys on opp Catálogo views
-- ═══════════════════════════════════════════════════════════════════════════════
-- Earlier builds used a ColumnMapper UI that created sub_item_columns with
-- auto-generated col_keys like `src_unit_price_1776794164590` (timestamped) and
-- stored the actual values on those columns. The later seed migrations added
-- sub_item_columns with clean col_keys (`unit_price`, `descripcion`), but the
-- live values stayed on the dirty ones.
--
-- The quote-materialization RPC matches columns by col_key — so values on
-- `src_*` columns were silently skipped, producing empty Partidas + monto=0.
--
-- Fix: for each opp Catálogo view, rename `src_*_*` columns back to their
-- original semantic col_key (carried in `source_col_key`). If a clean column
-- already exists at the target col_key, merge values and drop the dirty one.
--
-- After this, re-materializing a quote copies values correctly. Existing
-- quotes created before this fix must be deleted and re-materialized.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r record;
  v_clean_col_id uuid;
BEGIN
  FOR r IN
    SELECT sic.id         AS dirty_col_id,
           sic.view_id,
           sic.board_id,
           sic.col_key    AS dirty_col_key,
           sic.source_col_key,
           sic.position,
           sic.kind,
           sic.settings
    FROM sub_item_columns sic
    JOIN sub_item_views   siv ON siv.id = sic.view_id
    JOIN boards           b   ON b.id   = siv.board_id
    WHERE b.system_key = 'opportunities'
      AND siv.type     = 'native'
      AND sic.col_key LIKE 'src\_%' ESCAPE '\'
      AND sic.source_col_key IS NOT NULL
  LOOP
    -- Does the clean-keyed target column already exist on this view?
    SELECT id INTO v_clean_col_id
    FROM sub_item_columns
    WHERE view_id = r.view_id
      AND col_key = r.source_col_key;

    IF v_clean_col_id IS NULL THEN
      -- No clean column yet — just rename the dirty one in place.
      UPDATE sub_item_columns
      SET col_key = r.source_col_key
      WHERE id = r.dirty_col_id;
    ELSE
      -- Clean column exists: migrate values from dirty → clean, then drop dirty.
      -- Only move values for sub_items that don't already have a clean-col value
      -- (avoids UNIQUE(sub_item_id, column_id) violation).
      UPDATE sub_item_values AS sv
      SET column_id = v_clean_col_id
      WHERE sv.column_id = r.dirty_col_id
        AND NOT EXISTS (
          SELECT 1 FROM sub_item_values sv2
          WHERE sv2.sub_item_id = sv.sub_item_id
            AND sv2.column_id   = v_clean_col_id
        );

      DELETE FROM sub_item_values WHERE column_id = r.dirty_col_id;
      DELETE FROM sub_item_columns WHERE id = r.dirty_col_id;
    END IF;
  END LOOP;
END $$;

-- ── Enforce the opinionated design: unit_price + cantidad are manual ─────────

UPDATE sub_item_columns sic
SET source_col_key = NULL
FROM sub_item_views siv
JOIN boards b ON b.id = siv.board_id
WHERE sic.view_id = siv.id
  AND b.system_key = 'opportunities'
  AND siv.type     = 'native'
  AND sic.col_key IN ('unit_price', 'cantidad');
