-- ═══════════════════════════════════════════════════════════════════════════════
-- FOLIO PER BOARD — OPP-001, QUO-001, etc.
-- ═══════════════════════════════════════════════════════════════════════════════
-- Folio es un número secuencial monotónico por board. Nunca se reutiliza (si
-- borras OPP-003 y creas otro, será OPP-004). Formato y padding configurables
-- por columna (col_key='folio', kind='autonumber'). El usuario puede hide/show
-- vía board_view_columns.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PART 1: Schema ──────────────────────────────────────────────────────────

ALTER TABLE boards ADD COLUMN IF NOT EXISTS folio_prefix  text   DEFAULT 'ITEM';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS folio_counter bigint DEFAULT 0 NOT NULL;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS folio_pad     int    DEFAULT 3 NOT NULL;

ALTER TABLE items  ADD COLUMN IF NOT EXISTS folio_number  bigint;

CREATE INDEX IF NOT EXISTS idx_items_board_folio ON items (board_id, folio_number);

-- ── PART 2: Default prefixes per system board ───────────────────────────────

UPDATE boards SET folio_prefix = 'OPP' WHERE system_key = 'opportunities' AND folio_prefix = 'ITEM';
UPDATE boards SET folio_prefix = 'QUO' WHERE system_key = 'quotes'        AND folio_prefix = 'ITEM';
UPDATE boards SET folio_prefix = 'CON' WHERE system_key = 'contacts'      AND folio_prefix = 'ITEM';
UPDATE boards SET folio_prefix = 'INS' WHERE system_key = 'accounts'      AND folio_prefix = 'ITEM';
UPDATE boards SET folio_prefix = 'PRO' WHERE system_key = 'vendors'       AND folio_prefix = 'ITEM';
UPDATE boards SET folio_prefix = 'CAT' WHERE system_key = 'catalog'       AND folio_prefix = 'ITEM';

-- ── PART 3: Backfill items.folio_number by board, order by created_at ───────

DO $$
DECLARE
  b_rec RECORD;
  i_rec RECORD;
  n     bigint;
BEGIN
  FOR b_rec IN SELECT id FROM boards LOOP
    n := 0;
    FOR i_rec IN
      SELECT id FROM items
       WHERE board_id = b_rec.id AND folio_number IS NULL
       ORDER BY created_at ASC, position ASC, sid ASC
    LOOP
      n := n + 1;
      UPDATE items SET folio_number = n WHERE id = i_rec.id;
    END LOOP;
    -- Set counter to max folio_number on that board (handle pre-existing too)
    UPDATE boards
       SET folio_counter = COALESCE(
         (SELECT MAX(folio_number) FROM items WHERE board_id = b_rec.id),
         0
       )
     WHERE id = b_rec.id;
  END LOOP;
END $$;

-- ── PART 4: Trigger — assign folio_number on INSERT ─────────────────────────

CREATE OR REPLACE FUNCTION assign_item_folio() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.folio_number IS NULL THEN
    UPDATE boards
       SET folio_counter = folio_counter + 1
     WHERE id = NEW.board_id
     RETURNING folio_counter INTO NEW.folio_number;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_items_assign_folio ON items;
CREATE TRIGGER trg_items_assign_folio BEFORE INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION assign_item_folio();

-- ── PART 5: Inject `folio` column into every board (position -1, first col) ─

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT b.id, 'folio', 'Folio', 'autonumber', -1, true,
       jsonb_build_object(
         'prefix', b.folio_prefix,
         'pad',    b.folio_pad,
         'source', 'folio_number'
       )
  FROM boards b
 WHERE NOT EXISTS (
   SELECT 1 FROM board_columns bc
    WHERE bc.board_id = b.id AND bc.col_key = 'folio'
 );

-- ── PART 6: Extend inject_system_board_columns trigger to include folio ─────

CREATE OR REPLACE FUNCTION inject_system_board_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES
    (NEW.id, 'folio',      'Folio',               'autonumber', -1,  true,
      jsonb_build_object('prefix', NEW.folio_prefix, 'pad', NEW.folio_pad, 'source', 'folio_number')),
    (NEW.id, 'created_by', 'Creado por',          'people', 900, true, '{"display":"read_only"}'::jsonb),
    (NEW.id, 'created_at', 'Fecha de creación',   'date',   901, true, '{"display":"relative","read_only":true}'::jsonb),
    (NEW.id, 'updated_at', 'Última modificación', 'date',   902, true, '{"display":"relative","read_only":true}'::jsonb)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
