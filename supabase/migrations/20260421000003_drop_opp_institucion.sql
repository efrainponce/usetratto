-- =============================================================================
-- Drop `institucion` column from Oportunidades board.
-- Rationale: opp only links to contacto; the institución lives on contacto.
-- Institución is still reachable via opp.contacto.institucion chain.
-- =============================================================================

SET session_replication_role = replica;

-- 1. Delete item_values attached to opp.institucion columns (cascade via board_columns will handle,
--    but we explicit for clarity when multiple workspaces exist)
DELETE FROM item_values
WHERE column_id IN (
  SELECT bc.id FROM board_columns bc
  JOIN boards b ON bc.board_id = b.id
  WHERE b.system_key = 'opportunities' AND bc.col_key = 'institucion'
);

-- 2. Delete the column itself
DELETE FROM board_columns
WHERE col_key = 'institucion'
  AND board_id IN (SELECT id FROM boards WHERE system_key = 'opportunities');

-- 3. Remove Instituciones → Oportunidades sub_item_view (it pointed to opp.institucion relation col)
DELETE FROM sub_item_views
WHERE type = 'board_items'
  AND name = 'Oportunidades'
  AND board_id IN (SELECT id FROM boards WHERE system_key = 'accounts');

-- 4. Remove auto_fill_targets from opp.contacto (no longer autofills institucion since col is gone)
UPDATE board_columns
SET settings = settings - 'auto_fill_targets'
WHERE col_key = 'contacto'
  AND board_id IN (SELECT id FROM boards WHERE system_key = 'opportunities');

SET session_replication_role = DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Rewrite seed_system_boards to match new design
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_system_boards(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_opp_id        uuid;
  v_contacts_id   uuid;
  v_accounts_id   uuid;
  v_vendors_id    uuid;
  v_catalog_id    uuid;
  v_quotes_id     uuid;

  v_opp_contacto_col_id       uuid;
  v_contacts_institucion_col_id uuid;
  v_quote_oportunidad_col_id  uuid;
  v_quote_contacto_col_id     uuid;
  v_quote_institucion_col_id  uuid;

  v_default_template_id       uuid;
BEGIN

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'oportunidades', 'Oportunidades', 'pipeline', 'opportunities')
  RETURNING id INTO v_opp_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'contactos', 'Contactos', 'table', 'contacts')
  RETURNING id INTO v_contacts_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'instituciones', 'Instituciones', 'table', 'accounts')
  RETURNING id INTO v_accounts_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'proveedores', 'Proveedores', 'table', 'vendors')
  RETURNING id INTO v_vendors_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'catalogo', 'Catálogo', 'table', 'catalog')
  RETURNING id INTO v_catalog_id;

  INSERT INTO boards (workspace_id, slug, name, type, system_key)
  VALUES (p_workspace_id, 'cotizaciones', 'Cotizaciones', 'pipeline', 'quotes')
  RETURNING id INTO v_quotes_id;

  INSERT INTO board_stages (board_id, name, color, position) VALUES
    (v_opp_id, 'Nueva',       '#3B82F6', 0),
    (v_opp_id, 'Cotización',  '#8B5CF6', 1),
    (v_opp_id, 'Presentada',  '#10B981', 2),
    (v_opp_id, 'Cerrada',     '#6B7280', 3);

  INSERT INTO board_stages (board_id, name, color, position, is_closed) VALUES
    (v_quotes_id, 'Borrador',         '#94A3B8', 0, false),
    (v_quotes_id, 'Enviada',          '#3B82F6', 1, false),
    (v_quotes_id, 'Pendiente firma',  '#F59E0B', 2, false),
    (v_quotes_id, 'Firmada',          '#10B981', 3, true),
    (v_quotes_id, 'Anulada',          '#EF4444', 4, true);

  -- Oportunidades cols (sin institucion directa)
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_opp_id, 'name',     'Nombre',       'text',    0, true, '{}'::jsonb),
    (v_opp_id, 'stage',    'Etapa',        'select',  1, true, '{"role":"primary_stage"}'::jsonb),
    (v_opp_id, 'owner',    'Responsable',  'people',  2, true, '{"role":"owner"}'::jsonb),
    (v_opp_id, 'deadline', 'Fecha límite', 'date',    3, true, '{}'::jsonb),
    (v_opp_id, 'monto',    'Monto',        'number',  5, true, '{}'::jsonb);

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_opp_id, 'contacto', 'Contacto', 'relation', 4, true,
          jsonb_build_object('target_board_id', v_contacts_id, 'required', true))
  RETURNING id INTO v_opp_contacto_col_id;

  -- Contactos cols (institucion vive acá)
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_contacts_id, 'name',  'Nombre',   'text',   0, true, '{}'::jsonb),
    (v_contacts_id, 'phone', 'Teléfono', 'phone',  1, true, '{}'::jsonb),
    (v_contacts_id, 'email', 'Email',    'email',  2, true, '{}'::jsonb),
    (v_contacts_id, 'owner', 'Dueño',    'people', 3, true, '{"role":"owner"}'::jsonb);

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_contacts_id, 'institucion', 'Institución', 'relation', 4, true,
          jsonb_build_object('target_board_id', v_accounts_id))
  RETURNING id INTO v_contacts_institucion_col_id;

  -- Instituciones cols
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_accounts_id, 'name',  'Nombre', 'text',   0, true, '{}'::jsonb),
    (v_accounts_id, 'type',  'Tipo',   'select', 1, true, '{}'::jsonb),
    (v_accounts_id, 'owner', 'Dueño',  'people', 2, true, '{"role":"owner"}'::jsonb);

  -- Proveedores cols
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_vendors_id, 'name',       'Nombre',       'text',   0, true, '{}'::jsonb),
    (v_vendors_id, 'legal_name', 'Razón social', 'text',   1, true, '{}'::jsonb),
    (v_vendors_id, 'tax_id',     'RFC',          'text',   2, true, '{}'::jsonb),
    (v_vendors_id, 'phone',      'Teléfono',     'phone',  3, true, '{}'::jsonb),
    (v_vendors_id, 'email',      'Email',        'email',  4, true, '{}'::jsonb),
    (v_vendors_id, 'owner',      'Responsable',  'people', 5, true, '{"role":"owner"}'::jsonb);

  -- Catálogo cols
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_catalog_id, 'name',        'Nombre',         'text',   0, true, '{}'::jsonb),
    (v_catalog_id, 'descripcion', 'Descripción',    'text',   1, false, '{}'::jsonb),
    (v_catalog_id, 'foto',        'Foto',           'file',   2, false, jsonb_build_object('max_files', 1)),
    (v_catalog_id, 'unit_price',  'Precio unitario','number', 3, false, '{"format":"currency"}'::jsonb),
    (v_catalog_id, 'owner',       'Responsable',    'people', 4, true, '{"role":"owner"}'::jsonb);

  -- Cotizaciones cols (institucion sigue aquí — copiada del contacto en generación)
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_quotes_id, 'name',  'Nombre', 'text',   0, true, '{}'::jsonb),
    (v_quotes_id, 'stage', 'Etapa',  'select', 1, true, '{"role":"primary_stage"}'::jsonb);

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_quotes_id, 'oportunidad', 'Oportunidad', 'relation', 2, true,
          jsonb_build_object('target_board_id', v_opp_id))
  RETURNING id INTO v_quote_oportunidad_col_id;

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_quotes_id, 'contacto', 'Contacto', 'relation', 3, true,
          jsonb_build_object('target_board_id', v_contacts_id))
  RETURNING id INTO v_quote_contacto_col_id;

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_quotes_id, 'institucion', 'Institución', 'relation', 4, true,
          jsonb_build_object('target_board_id', v_accounts_id))
  RETURNING id INTO v_quote_institucion_col_id;

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_quotes_id, 'monto',         'Monto',        'number', 5, true, '{"format":"currency"}'::jsonb),
    (v_quotes_id, 'pdf_url',       'PDF',          'file',   6, true, '{}'::jsonb),
    (v_quotes_id, 'folio',         'Folio',        'text',   7, true, '{}'::jsonb),
    (v_quotes_id, 'signatures',    'Firmas',       'text',   8, true, '{"display":"json"}'::jsonb),
    (v_quotes_id, 'template_id',   'Plantilla',    'text',   9, true, '{}'::jsonb),
    (v_quotes_id, 'generated_by',  'Generado por', 'people', 10, true, '{}'::jsonb);

  -- Default template
  INSERT INTO document_templates (workspace_id, name, target_board_id, body_json, style_json, signature_config, status, created_by)
  VALUES (p_workspace_id, 'Cotización estándar', v_opp_id,
    jsonb_build_array(
      jsonb_build_object('id','h1','type','heading','level',1,'text','Cotización {{folio}}'),
      jsonb_build_object('id','t1','type','text','content','Para {{contacto}}'),
      jsonb_build_object('id','t2','type','text','content','Fecha: {{created_at|date}}'),
      jsonb_build_object('id','sp1','type','spacer','height',16),
      jsonb_build_object('id','d1','type','divider'),
      jsonb_build_object('id','sp2','type','spacer','height',8),
      jsonb_build_object('id','h2','type','heading','level',2,'text','Productos'),
      jsonb_build_object('id','r1','type','repeat','source','sub_items','blocks',jsonb_build_array(
        jsonb_build_object('id','rc1','type','columns','gap',16,'children',jsonb_build_array(
          jsonb_build_object('width','30%','blocks',jsonb_build_array(
            jsonb_build_object('id','ri1','type','image','source','col','col_key','foto','height',120,'fit','contain')
          )),
          jsonb_build_object('width','70%','blocks',jsonb_build_array(
            jsonb_build_object('id','rh1','type','heading','level',3,'text','{{name}}'),
            jsonb_build_object('id','rt1','type','text','content','{{descripcion}}'),
            jsonb_build_object('id','rf1','type','field','col_key','unit_price','label','Precio','layout','inline')
          ))
        )),
        jsonb_build_object('id','rsp1','type','spacer','height',12),
        jsonb_build_object('id','rd1','type','divider')
      )),
      jsonb_build_object('id','sp3','type','spacer','height',24),
      jsonb_build_object('id','tot1','type','total','source','rollup','col_key','monto','label','Total','format','money'),
      jsonb_build_object('id','sp4','type','spacer','height',48),
      jsonb_build_object('id','sig1','type','signature','role','cliente','label','Firma del cliente','required',true),
      jsonb_build_object('id','sig2','type','signature','role','vendedor','label','Firma del vendedor','auto_sign_by_owner',true)
    ),
    '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('role','cliente','required',true),
      jsonb_build_object('role','vendedor','required',false,'auto_sign_by_owner',true)
    ),
    'active',
    NULL
  )
  RETURNING id INTO v_default_template_id;

  -- Button column "Generar cotización"
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_opp_id, 'generar_cotizacion', 'Generar cotización', 'button', 6, true,
     jsonb_build_object(
       'label', 'Generar cotización',
       'action', 'generate_document',
       'template_id', v_default_template_id,
       'confirm', true,
       'confirm_message', '¿Generar cotización desde esta oportunidad?'
     ));

  -- ── Default sub_item_views (opinionated graph, sin opp→institucion) ─────

  -- Oportunidades: Catálogo + Cotizaciones
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_opp_id, p_workspace_id, 'Catálogo', 0, 'native',
      jsonb_build_object('source_board_id', v_catalog_id)),
    (v_opp_id, p_workspace_id, 'Cotizaciones', 1, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_oportunidad_col_id));

  -- Contactos: Oportunidades + Cotizaciones (via contacto rel)
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_contacts_id, p_workspace_id, 'Oportunidades', 0, 'board_items',
      jsonb_build_object('source_board_id', v_opp_id, 'relation_col_id', v_opp_contacto_col_id)),
    (v_contacts_id, p_workspace_id, 'Cotizaciones', 1, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_contacto_col_id));

  -- Instituciones: Contactos + Cotizaciones (opp se alcanza via contacto — 2 hops)
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_accounts_id, p_workspace_id, 'Contactos', 0, 'board_items',
      jsonb_build_object('source_board_id', v_contacts_id, 'relation_col_id', v_contacts_institucion_col_id)),
    (v_accounts_id, p_workspace_id, 'Cotizaciones', 1, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_institucion_col_id));

  -- Catálogo: Variantes
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_catalog_id, p_workspace_id, 'Variantes', 0, 'native', '{}'::jsonb);

END;
$$;
