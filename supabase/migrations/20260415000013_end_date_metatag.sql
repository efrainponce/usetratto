-- Fase 16.5: Add end_date metatag to existing deadline columns
-- =============================================================================

-- Backfill role='end_date' on existing deadline columns
UPDATE board_columns
  SET settings = coalesce(settings, '{}'::jsonb) || '{"role":"end_date"}'::jsonb
  WHERE col_key = 'deadline'
    AND kind = 'date'
    AND (settings IS NULL OR settings->>'role' IS NULL);

-- Update seed_system_boards function to include role='end_date' on opportunities.deadline
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
    (v_opportunities_id, 'deadline', 'Fecha límite', 'date',    3, true, '{"role":"end_date"}'::jsonb),
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
