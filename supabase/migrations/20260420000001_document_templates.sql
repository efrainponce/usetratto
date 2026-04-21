-- Fase 18.1 — Document Templates system
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. document_templates table
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE document_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sid             bigint      UNIQUE NOT NULL DEFAULT generate_sid(),
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  target_board_id uuid        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  body_json       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  style_json      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  signature_config jsonb      NOT NULL DEFAULT '[]'::jsonb,
  pre_conditions  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  folio_format    text,
  status          text        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','archived')),
  created_by      uuid        REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_templates_workspace ON document_templates(workspace_id);
CREATE INDEX idx_document_templates_target_board ON document_templates(target_board_id);
CREATE INDEX idx_document_templates_status ON document_templates(status) WHERE status='active';

-- RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_templates_select ON document_templates FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
);

CREATE POLICY document_templates_write ON document_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND workspace_id = document_templates.workspace_id AND role IN ('admin','superadmin'))
  OR EXISTS (SELECT 1 FROM board_members WHERE board_id = target_board_id AND user_id = auth.uid() AND access = 'admin')
);

-- Trigger for updated_at
CREATE TRIGGER set_document_templates_updated_at BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. document_audit_events table
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE document_audit_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_item_id uuid       NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,
  actor_id        uuid        REFERENCES users(id),
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_audit_events_doc ON document_audit_events(document_item_id, created_at DESC);

-- RLS
ALTER TABLE document_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_audit_events_select ON document_audit_events FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Update seed_system_boards to include documents board
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
  v_documents_id uuid;
  v_stage_id uuid;
BEGIN

  -- ── Step 1: Create all 6 boards ────────────────────────────────────────

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

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'documentos', 'Documentos', 'table', 'documents')
  RETURNING id INTO v_documents_id;

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

  -- Documents
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_documents_id, 'name',           'Nombre',            'text',   0, true, '{}'::jsonb),
    (v_documents_id, 'template_id',    'Plantilla',         'text',   1, true, '{}'::jsonb),
    (v_documents_id, 'source_item_id', 'Item de origen',    'text',   2, true, '{}'::jsonb),
    (v_documents_id, 'pdf_url',        'PDF',               'file',   3, true, '{}'::jsonb),
    (v_documents_id, 'folio',          'Folio',             'text',   4, true, '{}'::jsonb),
    (v_documents_id, 'status',         'Estado',            'select', 5, true, jsonb_build_object('options', jsonb_build_array(
      jsonb_build_object('label', 'Borrador', 'value', 'draft', 'color', '#94a3b8'),
      jsonb_build_object('label', 'Enviado', 'value', 'sent', 'color', '#3b82f6'),
      jsonb_build_object('label', 'Pendiente firma', 'value', 'pending_signature', 'color', '#f59e0b'),
      jsonb_build_object('label', 'Firmado', 'value', 'signed', 'color', '#10b981', 'is_closed', true),
      jsonb_build_object('label', 'Anulado', 'value', 'void', 'color', '#ef4444', 'is_closed', true)
    ))),
    (v_documents_id, 'signatures',     'Firmas',            'text',   6, true, '{"display":"json"}'::jsonb),
    (v_documents_id, 'generated_by',   'Generado por',      'people', 7, true, '{}'::jsonb);

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
    (v_catalog_id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_documents_id, 'created_by', 'Creado por', 'people', 900, true, '{"display":"read_only"}'::jsonb),
    (v_documents_id, 'created_at', 'Fecha de creación', 'date', 901, true, '{"display":"relative","read_only":true}'::jsonb),
    (v_documents_id, 'updated_at', 'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb)
  ON CONFLICT DO NOTHING;

END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Backfill: Create documents board for existing workspaces
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_workspace_id uuid;
  v_documents_board_id uuid;
BEGIN
  FOR v_workspace_id IN
    SELECT DISTINCT id FROM workspaces
    WHERE NOT EXISTS (
      SELECT 1 FROM boards WHERE workspace_id = workspaces.id AND system_key = 'documents'
    )
  LOOP
    INSERT INTO boards (workspace_id, slug, name, type, system_key)
    VALUES (v_workspace_id, 'documentos', 'Documentos', 'table', 'documents')
    RETURNING id INTO v_documents_board_id;

    -- Insert columns for this new documents board
    INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
      (v_documents_board_id, 'name',           'Nombre',            'text',   0, true, '{}'::jsonb),
      (v_documents_board_id, 'template_id',    'Plantilla',         'text',   1, true, '{}'::jsonb),
      (v_documents_board_id, 'source_item_id', 'Item de origen',    'text',   2, true, '{}'::jsonb),
      (v_documents_board_id, 'pdf_url',        'PDF',               'file',   3, true, '{}'::jsonb),
      (v_documents_board_id, 'folio',          'Folio',             'text',   4, true, '{}'::jsonb),
      (v_documents_board_id, 'status',         'Estado',            'select', 5, true, jsonb_build_object('options', jsonb_build_array(
        jsonb_build_object('label', 'Borrador', 'value', 'draft', 'color', '#94a3b8'),
        jsonb_build_object('label', 'Enviado', 'value', 'sent', 'color', '#3b82f6'),
        jsonb_build_object('label', 'Pendiente firma', 'value', 'pending_signature', 'color', '#f59e0b'),
        jsonb_build_object('label', 'Firmado', 'value', 'signed', 'color', '#10b981', 'is_closed', true),
        jsonb_build_object('label', 'Anulado', 'value', 'void', 'color', '#ef4444', 'is_closed', true)
      ))),
      (v_documents_board_id, 'signatures',     'Firmas',            'text',   6, true, '{"display":"json"}'::jsonb),
      (v_documents_board_id, 'generated_by',   'Generado por',      'people', 7, true, '{}'::jsonb),
      (v_documents_board_id, 'created_by',     'Creado por',        'people', 900, true, '{"display":"read_only"}'::jsonb),
      (v_documents_board_id, 'created_at',     'Fecha de creación', 'date',   901, true, '{"display":"relative","read_only":true}'::jsonb),
      (v_documents_board_id, 'updated_at',     'Última modificación', 'date', 902, true, '{"display":"relative","read_only":true}'::jsonb)
    ON CONFLICT (board_id, col_key) DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Rollback notes
-- ─────────────────────────────────────────────────────────────────────────
-- To rollback:
-- 1. DROP TABLE document_audit_events CASCADE;
-- 2. DROP TABLE document_templates CASCADE;
-- 3. DELETE FROM board_columns WHERE board_id IN (SELECT id FROM boards WHERE system_key='documents');
-- 4. DELETE FROM boards WHERE system_key='documents';
-- 5. Execute: CREATE OR REPLACE FUNCTION seed_system_boards() with original function body (6 boards -> 5 boards)
