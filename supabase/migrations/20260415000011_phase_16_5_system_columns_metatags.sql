-- Fase 16.5: System columns, metatags, and sub-item activity logging
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Schema additions: created_by, updated_at, is_system
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE items ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

ALTER TABLE sub_items ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);
ALTER TABLE sub_items ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE sub_item_columns ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Trigger for sub_items.updated_at
-- ─────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sub_items_updated_at ON sub_items;
CREATE TRIGGER trg_sub_items_updated_at BEFORE UPDATE ON sub_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Triggers for sub-item activity logging (16.5.D fix)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_sub_item_activity() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO item_activity (workspace_id, item_id, sub_item_id, actor_id, action, metadata)
    VALUES (NEW.workspace_id, NEW.item_id, NEW.id, auth.uid(), 'sub_item_created',
            jsonb_build_object('sub_item_name', NEW.name, 'depth', NEW.depth));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO item_activity (workspace_id, item_id, sub_item_id, actor_id, action, metadata)
    VALUES (OLD.workspace_id, OLD.item_id, OLD.id, auth.uid(), 'sub_item_deleted',
            jsonb_build_object('sub_item_name', OLD.name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION log_sub_item_value_activity() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_parent_item uuid;
  v_workspace uuid;
  v_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT item_id, workspace_id, name INTO v_parent_item, v_workspace, v_name
      FROM sub_items WHERE id = OLD.sub_item_id;
    IF v_parent_item IS NULL THEN RETURN OLD; END IF;
    INSERT INTO item_activity (workspace_id, item_id, sub_item_id, actor_id, action, old_value, metadata)
    VALUES (v_workspace, v_parent_item, OLD.sub_item_id, auth.uid(), 'sub_item_value_changed',
            to_jsonb(OLD), jsonb_build_object('column_id', OLD.column_id, 'sub_item_name', v_name));
    RETURN OLD;
  ELSE
    SELECT item_id, workspace_id, name INTO v_parent_item, v_workspace, v_name
      FROM sub_items WHERE id = NEW.sub_item_id;
    IF v_parent_item IS NULL THEN RETURN NEW; END IF;
    INSERT INTO item_activity (workspace_id, item_id, sub_item_id, actor_id, action, old_value, new_value, metadata)
    VALUES (v_workspace, v_parent_item, NEW.sub_item_id, auth.uid(), 'sub_item_value_changed',
            CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            to_jsonb(NEW), jsonb_build_object('column_id', NEW.column_id, 'sub_item_name', v_name));
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sub_item_activity ON sub_items;
CREATE TRIGGER trg_sub_item_activity
  AFTER INSERT OR DELETE ON sub_items
  FOR EACH ROW EXECUTE FUNCTION log_sub_item_activity();

DROP TRIGGER IF EXISTS trg_sub_item_value_activity ON sub_item_values;
CREATE TRIGGER trg_sub_item_value_activity
  AFTER INSERT OR UPDATE OR DELETE ON sub_item_values
  FOR EACH ROW EXECUTE FUNCTION log_sub_item_value_activity();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Auto-populate created_by on INSERT
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_created_by() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_items_created_by ON items;
CREATE TRIGGER trg_items_created_by BEFORE INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trg_sub_items_created_by ON sub_items;
CREATE TRIGGER trg_sub_items_created_by BEFORE INSERT ON sub_items
  FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Update seed_system_boards with metatags, relations, and system cols
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_system_boards(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_opportunities_id uuid;
  v_contacts_id uuid;
  v_accounts_id uuid;
  v_vendors_id uuid;
  v_catalog_id uuid;
  v_stage_id uuid;
BEGIN

  -- ── Step 1: Create all 5 boards ────────────────────────────────────────

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'oportunidades', 'Oportunidades', 'pipeline', 'opportunities')
  RETURNING id INTO v_opportunities_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'contactos', 'Contactos', 'table', 'contacts')
  RETURNING id INTO v_contacts_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'cuentas', 'Cuentas', 'table', 'accounts')
  RETURNING id INTO v_accounts_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'proveedores', 'Proveedores', 'table', 'vendors')
  RETURNING id INTO v_vendors_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'catalogo', 'Catálogo', 'table', 'catalog')
  RETURNING id INTO v_catalog_id;

  -- ── Step 2: Opportunities stages ───────────────────────────────────────

  INSERT INTO board_stages (board_id, name, color, position) VALUES
    (v_opportunities_id, 'Nueva',       '#3B82F6', 0),
    (v_opportunities_id, 'Cotización',  '#8B5CF6', 1),
    (v_opportunities_id, 'Costeo',      '#F59E0B', 2),
    (v_opportunities_id, 'Presentada',  '#10B981', 3),
    (v_opportunities_id, 'Cerrada',     '#6B7280', 4);

  -- ── Step 3: Insert core columns per board ──────────────────────────────

  -- Opportunities
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_opportunities_id, 'name',     'Nombre',       'text',    0, true, '{}'::jsonb),
    (v_opportunities_id, 'stage',    'Etapa',        'select',  1, true, '{"role":"primary_stage"}'::jsonb),
    (v_opportunities_id, 'owner',    'Responsable',  'people',  2, true, '{"role":"owner"}'::jsonb),
    (v_opportunities_id, 'deadline', 'Fecha límite', 'date',    3, true, '{}'::jsonb),
    (v_opportunities_id, 'contacto', 'Contacto',     'relation', 4, true, jsonb_build_object('target_board_id', v_contacts_id, 'required', true, 'auto_fill_targets', jsonb_build_array(jsonb_build_object('source_col_key', 'institucion', 'target_col_key', 'institucion')))),
    (v_opportunities_id, 'institucion', 'Institución', 'relation', 5, true, jsonb_build_object('target_board_id', v_accounts_id, 'required', true)),
    (v_opportunities_id, 'monto',    'Monto',        'number',  6, true, '{}'::jsonb);

  -- Contacts
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_contacts_id, 'name',    'Nombre',  'text',    0, true, '{}'::jsonb),
    (v_contacts_id, 'phone',   'Teléfono','phone',   1, true, '{}'::jsonb),
    (v_contacts_id, 'email',   'Email',   'email',   2, true, '{}'::jsonb),
    (v_contacts_id, 'owner',   'Dueño',   'people',  3, true, '{"role":"owner"}'::jsonb),
    (v_contacts_id, 'account', 'Cuenta',  'relation',4, true, '{}'::jsonb),
    (v_contacts_id, 'institucion', 'Institución', 'relation', 5, true, jsonb_build_object('target_board_id', v_accounts_id));

  -- Accounts
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_accounts_id, 'name',  'Nombre', 'text',   0, true, '{}'::jsonb),
    (v_accounts_id, 'type',  'Tipo',   'select', 1, true, '{}'::jsonb),
    (v_accounts_id, 'owner', 'Dueño',  'people', 2, true, '{"role":"owner"}'::jsonb);

  -- Vendors
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_vendors_id, 'name',       'Nombre',         'text',  0, true, '{}'::jsonb),
    (v_vendors_id, 'legal_name', 'Razón social',   'text',  1, true, '{}'::jsonb),
    (v_vendors_id, 'tax_id',     'RFC',            'text',  2, true, '{}'::jsonb),
    (v_vendors_id, 'phone',      'Teléfono',       'phone', 3, true, '{}'::jsonb),
    (v_vendors_id, 'email',      'Email',          'email', 4, true, '{}'::jsonb),
    (v_vendors_id, 'owner',      'Responsable',    'people',5, true, '{"role":"owner"}'::jsonb);

  -- Catalog
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_catalog_id, 'name',  'Nombre',      'text',   0, true, '{}'::jsonb),
    (v_catalog_id, 'owner', 'Responsable', 'people', 1, true, '{"role":"owner"}'::jsonb);

  -- ── Step 4: Auto-inject 3 system columns per board ─────────────────────

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES
    (v_opportunities_id, 'created_by', 'Creado por', 'people', 900, true, '{"display":"read_only"}'::jsonb),
    (v_opportunities_id, 'created_at', 'Fecha de creación', 'date', 901, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_opportunities_id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_contacts_id, 'created_by', 'Creado por', 'people', 900, true, '{"display":"read_only"}'::jsonb),
    (v_contacts_id, 'created_at', 'Fecha de creación', 'date', 901, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_contacts_id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_accounts_id, 'created_by', 'Creado por', 'people', 900, true, '{"display":"read_only"}'::jsonb),
    (v_accounts_id, 'created_at', 'Fecha de creación', 'date', 901, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_accounts_id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_vendors_id, 'created_by', 'Creado por', 'people', 900, true, '{"display":"read_only"}'::jsonb),
    (v_vendors_id, 'created_at', 'Fecha de creación', 'date', 901, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_vendors_id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_catalog_id, 'created_by', 'Creado por', 'people', 900, true, '{"display":"read_only"}'::jsonb),
    (v_catalog_id, 'created_at', 'Fecha de creación', 'date', 901, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_catalog_id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb)
  ON CONFLICT DO NOTHING;

END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Trigger for new board creation (auto-inject system columns)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION inject_system_board_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES
    (NEW.id, 'created_by', 'Creado por', 'people', 900, true, '{"display":"read_only"}'::jsonb),
    (NEW.id, 'created_at', 'Fecha de creación', 'date', 901, true, '{"display":"relative","read_only":true}'::jsonb),
    (NEW.id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_boards_inject_system_cols ON boards;
CREATE TRIGGER trg_boards_inject_system_cols AFTER INSERT ON boards
  FOR EACH ROW EXECUTE FUNCTION inject_system_board_columns();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Backfill system columns into existing boards
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT b.id, 'created_by', 'Creado por', 'people', 900, true, '{"display":"read_only"}'::jsonb
  FROM boards b WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE board_id=b.id AND col_key='created_by')
ON CONFLICT DO NOTHING;

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT b.id, 'created_at', 'Fecha de creación', 'date', 901, true, '{"display":"relative","read_only":true}'::jsonb
  FROM boards b WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE board_id=b.id AND col_key='created_at')
ON CONFLICT DO NOTHING;

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT b.id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb
  FROM boards b WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE board_id=b.id AND col_key='updated_at')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Backfill metatags on existing stage and owner columns
-- ─────────────────────────────────────────────────────────────────────────

UPDATE board_columns SET settings = coalesce(settings,'{}'::jsonb) || '{"role":"primary_stage"}'::jsonb
  WHERE col_key='stage' AND kind='select' AND (settings IS NULL OR settings->>'role' IS NULL);

UPDATE board_columns SET settings = coalesce(settings,'{}'::jsonb) || '{"role":"owner"}'::jsonb
  WHERE col_key='owner' AND kind='people' AND (settings IS NULL OR settings->>'role' IS NULL);
