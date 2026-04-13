-- =============================================================================
-- 002_functions_triggers.sql
-- Tratto — funciones, triggers, y auto-provisioning
-- =============================================================================

-- ---------------------------------------------------------------------------
-- find_by_sid(bigint) — busca cualquier entidad por sid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_by_sid(p_sid bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- workspaces
  SELECT jsonb_build_object('table','workspaces','id',id,'sid',sid,'name',name)
  INTO result FROM workspaces WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- users
  SELECT jsonb_build_object('table','users','id',id,'sid',sid,'name',name)
  INTO result FROM users WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- teams
  SELECT jsonb_build_object('table','teams','id',id,'sid',sid,'name',name)
  INTO result FROM teams WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- territories
  SELECT jsonb_build_object('table','territories','id',id,'sid',sid,'name',name)
  INTO result FROM territories WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- boards
  SELECT jsonb_build_object('table','boards','id',id,'sid',sid,'name',name,'slug',slug)
  INTO result FROM boards WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- board_stages
  SELECT jsonb_build_object('table','board_stages','id',id,'sid',sid,'name',name)
  INTO result FROM board_stages WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- board_columns
  SELECT jsonb_build_object('table','board_columns','id',id,'sid',sid,'name',name,'col_key',col_key)
  INTO result FROM board_columns WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- items
  SELECT jsonb_build_object('table','items','id',id,'sid',sid,'name',name,'board_id',board_id)
  INTO result FROM items WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- sub_items
  SELECT jsonb_build_object('table','sub_items','id',id,'sid',sid,'name',name,'item_id',item_id)
  INTO result FROM sub_items WHERE sid = p_sid;
  IF result IS NOT NULL THEN RETURN result; END IF;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- seed_system_boards(workspace_id) — crea 5 boards de sistema + columnas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_system_boards(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_board_id   uuid;
  v_stage_id   uuid;
BEGIN

  -- ── OPPORTUNITIES (pipeline) ──────────────────────────────────────────────
  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'oportunidades', 'Oportunidades', 'pipeline', 'opportunities')
  RETURNING id INTO v_board_id;

  -- Stages
  INSERT INTO board_stages (board_id, name, color, position) VALUES
    (v_board_id, 'Nueva',       '#3B82F6', 0),
    (v_board_id, 'Cotización',  '#8B5CF6', 1),
    (v_board_id, 'Costeo',      '#F59E0B', 2),
    (v_board_id, 'Presentada',  '#10B981', 3),
    (v_board_id, 'Cerrada',     '#6B7280', 4);

  -- System columns
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system) VALUES
    (v_board_id, 'name',     'Nombre',       'text',    0, true),
    (v_board_id, 'stage',    'Etapa',        'select',  1, true),
    (v_board_id, 'owner',    'Responsable',  'people',  2, true),
    (v_board_id, 'deadline', 'Fecha límite', 'date',    3, true);

  -- ── CONTACTS (table) ──────────────────────────────────────────────────────
  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'contactos', 'Contactos', 'table', 'contacts')
  RETURNING id INTO v_board_id;

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system) VALUES
    (v_board_id, 'name',    'Nombre',  'text',    0, true),
    (v_board_id, 'phone',   'Teléfono','phone',   1, true),
    (v_board_id, 'email',   'Email',   'email',   2, true),
    (v_board_id, 'owner',   'Dueño',   'people',  3, true),
    (v_board_id, 'account', 'Cuenta',  'relation',4, true);

  -- ── ACCOUNTS (table) ──────────────────────────────────────────────────────
  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'cuentas', 'Cuentas', 'table', 'accounts')
  RETURNING id INTO v_board_id;

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system) VALUES
    (v_board_id, 'name',  'Nombre', 'text',   0, true),
    (v_board_id, 'type',  'Tipo',   'select', 1, true),
    (v_board_id, 'owner', 'Dueño',  'people', 2, true);

  -- ── VENDORS (table) ───────────────────────────────────────────────────────
  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'proveedores', 'Proveedores', 'table', 'vendors')
  RETURNING id INTO v_board_id;

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system) VALUES
    (v_board_id, 'name',       'Nombre',         'text',  0, true),
    (v_board_id, 'legal_name', 'Razón social',   'text',  1, true),
    (v_board_id, 'tax_id',     'RFC',            'text',  2, true),
    (v_board_id, 'phone',      'Teléfono',       'phone', 3, true),
    (v_board_id, 'email',      'Email',          'email', 4, true),
    (v_board_id, 'owner',      'Responsable',    'people',5, true);

  -- ── CATALOG (table) ───────────────────────────────────────────────────────
  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'catalogo', 'Catálogo', 'table', 'catalog')
  RETURNING id INTO v_board_id;

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system) VALUES
    (v_board_id, 'name',  'Nombre',      'text',   0, true),
    (v_board_id, 'owner', 'Responsable', 'people', 1, true);

END;
$$;

-- ---------------------------------------------------------------------------
-- handle_new_auth_user() — trigger: auto-provisioning en primer login
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_phone text;
BEGIN
  -- Normaliza phone: puede venir en raw_user_meta_data o phone del auth.users
  v_phone := COALESCE(
    NEW.phone,
    NEW.raw_user_meta_data->>'phone'
  );

  INSERT INTO users (id, name, phone, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    v_phone,
    NEW.email,
    'member'  -- workspace_id se asigna después via admin o invite flow
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- trg_items_updated_at — actualiza updated_at al modificar items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- trg_default_channels — auto-crea "General" y "Sistema" al insertar item
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_default_channels()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO item_channels (workspace_id, item_id, name, type, position)
  VALUES
    (NEW.workspace_id, NEW.id, 'General', 'internal', 0),
    (NEW.workspace_id, NEW.id, 'Sistema', 'system',   1);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_default_channels
  AFTER INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION create_default_channels();

-- ---------------------------------------------------------------------------
-- trg_item_activity — log automático de cambios en items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_item_activity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO item_activity (workspace_id, item_id, action, new_value)
    VALUES (NEW.workspace_id, NEW.id, 'created',
            jsonb_build_object('name', NEW.name));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Stage change
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      INSERT INTO item_activity (workspace_id, item_id, action, old_value, new_value)
      VALUES (NEW.workspace_id, NEW.id, 'stage_changed',
              jsonb_build_object('stage_id', OLD.stage_id),
              jsonb_build_object('stage_id', NEW.stage_id));
    END IF;

    -- Name change
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      INSERT INTO item_activity (workspace_id, item_id, action, old_value, new_value)
      VALUES (NEW.workspace_id, NEW.id, 'updated',
              jsonb_build_object('name', OLD.name),
              jsonb_build_object('name', NEW.name));
    END IF;

    -- Owner change
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      INSERT INTO item_activity (workspace_id, item_id, action, old_value, new_value)
      VALUES (NEW.workspace_id, NEW.id, 'owner_changed',
              jsonb_build_object('owner_id', OLD.owner_id),
              jsonb_build_object('owner_id', NEW.owner_id));
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO item_activity (workspace_id, item_id, action, old_value)
    VALUES (OLD.workspace_id, OLD.id, 'deleted',
            jsonb_build_object('name', OLD.name));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_item_activity
  AFTER INSERT OR UPDATE OR DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION log_item_activity();
