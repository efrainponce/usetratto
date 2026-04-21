-- =============================================================================
-- Fase 18.5/18.6/18.7/18.8 — Quotes board + opinionated knowledge graph
-- Renames `documents` → `quotes` (pipeline), adds default sub_item_views per
-- system board, seeds default template + "Generar cotización" button.
-- Wipes CMP workspace and re-seeds (dummy data only).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Wipe CMP workspace data (dummy, no production)
-- ─────────────────────────────────────────────────────────────────────────

-- Everything cascades via FK ON DELETE CASCADE from workspace_id
-- but we explicitly delete to be safe
-- Temporarily disable triggers so cascade deletes don't re-insert audit/activity rows
SET session_replication_role = replica;

DO $$
DECLARE
  v_cmp_id uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
BEGIN
  -- Document-related
  DELETE FROM document_audit_events WHERE workspace_id = v_cmp_id;
  DELETE FROM document_templates WHERE workspace_id = v_cmp_id;

  -- Activity (may reference items/sub_items without strict cascade)
  DELETE FROM item_activity WHERE workspace_id = v_cmp_id;

  -- Channel data
  DELETE FROM channel_messages WHERE workspace_id = v_cmp_id;
  DELETE FROM channel_members WHERE channel_id IN (SELECT id FROM item_channels WHERE workspace_id = v_cmp_id);
  DELETE FROM item_channels WHERE workspace_id = v_cmp_id;

  -- Sub-item values (explicit before cascade)
  DELETE FROM sub_item_values WHERE sub_item_id IN (SELECT id FROM sub_items WHERE workspace_id = v_cmp_id);
  DELETE FROM sub_items WHERE workspace_id = v_cmp_id;

  -- Item values + items
  DELETE FROM item_values WHERE item_id IN (SELECT id FROM items WHERE workspace_id = v_cmp_id);
  DELETE FROM items WHERE workspace_id = v_cmp_id;

  -- Column permissions attached to board columns of this workspace
  DELETE FROM column_permissions WHERE column_id IN (
    SELECT id FROM board_columns WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = v_cmp_id)
  );

  -- Boards cascade columns, stages, members, sub_item_views, sub_item_columns
  DELETE FROM boards WHERE workspace_id = v_cmp_id;
END $$;

SET session_replication_role = DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Rewrite seed_system_boards — opinionated knowledge graph
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

  -- column ids we need for sub_item_views config + button template
  v_opp_contacto_col_id       uuid;
  v_opp_institucion_col_id    uuid;
  v_contacts_institucion_col_id uuid;
  v_quote_oportunidad_col_id  uuid;
  v_quote_contacto_col_id     uuid;
  v_quote_institucion_col_id  uuid;

  v_default_template_id       uuid;
BEGIN

  -- ── Boards (6) ──────────────────────────────────────────────────────────

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

  -- ── Stages ──────────────────────────────────────────────────────────────

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

  -- ── Oportunidades columns ───────────────────────────────────────────────

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_opp_id, 'name',     'Nombre',       'text',    0, true, '{}'::jsonb),
    (v_opp_id, 'stage',    'Etapa',        'select',  1, true, '{"role":"primary_stage"}'::jsonb),
    (v_opp_id, 'owner',    'Responsable',  'people',  2, true, '{"role":"owner"}'::jsonb),
    (v_opp_id, 'deadline', 'Fecha límite', 'date',    3, true, '{}'::jsonb),
    (v_opp_id, 'monto',    'Monto',        'number',  6, true, '{}'::jsonb);

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_opp_id, 'contacto', 'Contacto', 'relation', 4, true,
          jsonb_build_object('target_board_id', v_contacts_id, 'required', true,
            'auto_fill_targets', jsonb_build_array(
              jsonb_build_object('source_col_key', 'institucion', 'target_col_key', 'institucion'))))
  RETURNING id INTO v_opp_contacto_col_id;

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_opp_id, 'institucion', 'Institución', 'relation', 5, true,
          jsonb_build_object('target_board_id', v_accounts_id, 'required', true))
  RETURNING id INTO v_opp_institucion_col_id;

  -- ── Contactos columns ───────────────────────────────────────────────────

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_contacts_id, 'name',    'Nombre',   'text',   0, true, '{}'::jsonb),
    (v_contacts_id, 'phone',   'Teléfono', 'phone',  1, true, '{}'::jsonb),
    (v_contacts_id, 'email',   'Email',    'email',  2, true, '{}'::jsonb),
    (v_contacts_id, 'owner',   'Dueño',    'people', 3, true, '{"role":"owner"}'::jsonb);

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_contacts_id, 'institucion', 'Institución', 'relation', 4, true,
          jsonb_build_object('target_board_id', v_accounts_id))
  RETURNING id INTO v_contacts_institucion_col_id;

  -- ── Instituciones columns ───────────────────────────────────────────────

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_accounts_id, 'name',  'Nombre', 'text',   0, true, '{}'::jsonb),
    (v_accounts_id, 'type',  'Tipo',   'select', 1, true, '{}'::jsonb),
    (v_accounts_id, 'owner', 'Dueño',  'people', 2, true, '{"role":"owner"}'::jsonb);

  -- ── Proveedores columns ─────────────────────────────────────────────────

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_vendors_id, 'name',       'Nombre',        'text',   0, true, '{}'::jsonb),
    (v_vendors_id, 'legal_name', 'Razón social',  'text',   1, true, '{}'::jsonb),
    (v_vendors_id, 'tax_id',     'RFC',           'text',   2, true, '{}'::jsonb),
    (v_vendors_id, 'phone',      'Teléfono',      'phone',  3, true, '{}'::jsonb),
    (v_vendors_id, 'email',      'Email',         'email',  4, true, '{}'::jsonb),
    (v_vendors_id, 'owner',      'Responsable',   'people', 5, true, '{"role":"owner"}'::jsonb);

  -- ── Catálogo columns ────────────────────────────────────────────────────

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_catalog_id, 'name',        'Nombre',        'text',   0, true, '{}'::jsonb),
    (v_catalog_id, 'descripcion', 'Descripción',   'text',   1, false, '{}'::jsonb),
    (v_catalog_id, 'foto',        'Foto',          'file',   2, false, jsonb_build_object('max_files', 1)),
    (v_catalog_id, 'unit_price',  'Precio unitario','number', 3, false, '{"format":"currency"}'::jsonb),
    (v_catalog_id, 'owner',       'Responsable',   'people', 4, true, '{"role":"owner"}'::jsonb);

  -- ── Cotizaciones columns ────────────────────────────────────────────────

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

  -- ── Default template "Cotización estándar" ─────────────────────────────

  INSERT INTO document_templates (workspace_id, name, target_board_id, body_json, style_json, signature_config, status, created_by)
  VALUES (p_workspace_id, 'Cotización estándar', v_opp_id,
    jsonb_build_array(
      jsonb_build_object('id','h1','type','heading','level',1,'text','Cotización {{folio}}'),
      jsonb_build_object('id','t1','type','text','content','Para {{contacto}} — {{institucion}}'),
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

  -- ── Button column in Oportunidades: "Generar cotización" ───────────────

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_opp_id, 'generar_cotizacion', 'Generar cotización', 'button', 7, true,
     jsonb_build_object(
       'label', 'Generar cotización',
       'action', 'generate_document',
       'template_id', v_default_template_id,
       'confirm', true,
       'confirm_message', '¿Generar cotización desde esta oportunidad?'
     ));

  -- ── Default sub_item_views per board (opinionated knowledge graph) ─────

  -- Oportunidades: Catálogo (native con snapshot source) + Cotizaciones (reverse via oportunidad rel)
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_opp_id, p_workspace_id, 'Catálogo', 0, 'native',
      jsonb_build_object('source_board_id', v_catalog_id)),
    (v_opp_id, p_workspace_id, 'Cotizaciones', 1, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_oportunidad_col_id));

  -- Contactos: Oportunidades + Cotizaciones (ambos reverse via contacto rel)
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_contacts_id, p_workspace_id, 'Oportunidades', 0, 'board_items',
      jsonb_build_object('source_board_id', v_opp_id, 'relation_col_id', v_opp_contacto_col_id)),
    (v_contacts_id, p_workspace_id, 'Cotizaciones', 1, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_contacto_col_id));

  -- Instituciones: Contactos + Oportunidades + Cotizaciones
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_accounts_id, p_workspace_id, 'Contactos', 0, 'board_items',
      jsonb_build_object('source_board_id', v_contacts_id, 'relation_col_id', v_contacts_institucion_col_id)),
    (v_accounts_id, p_workspace_id, 'Oportunidades', 1, 'board_items',
      jsonb_build_object('source_board_id', v_opp_id, 'relation_col_id', v_opp_institucion_col_id)),
    (v_accounts_id, p_workspace_id, 'Cotizaciones', 2, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_institucion_col_id));

  -- Catálogo: Variantes (native L2 manual)
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_catalog_id, p_workspace_id, 'Variantes', 0, 'native', '{}'::jsonb);

  -- Cotizaciones: sin sub-item-views default (terminal)
  -- Proveedores: sin sub-item-views default

END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Re-seed CMP workspace
-- ─────────────────────────────────────────────────────────────────────────

SELECT seed_system_boards('aaaaaaaa-0000-0000-0000-000000000001');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Rollback notes
-- ─────────────────────────────────────────────────────────────────────────
-- Rollback = restore seed_system_boards from 20260420000001 + manually delete
-- cotizaciones board and restore documents board (dummy data, regenerate via seed).
