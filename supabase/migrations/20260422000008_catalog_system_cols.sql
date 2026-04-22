-- ═══════════════════════════════════════════════════════════════════════════════
-- CATALOG DEFAULT COLS AS SYSTEM + ADD `unidad`
-- ═══════════════════════════════════════════════════════════════════════════════
-- Goal: the catalog columns we rely on to build cotizaciones (foto, sku,
-- descripcion, unit_price, cantidad, unidad, subtotal) live in every workspace
-- as is_system=true so they cannot be renamed/deleted and new workspaces get
-- them automatically via seed_system_boards().
--
-- Current post-migration-0422000005 order of Catálogo board:
--   foto=1 (image), sku=2, descripcion=3, unit_price=4, owner=5
-- Target:
--   foto=1, sku=2, descripcion=3, unit_price=4, unidad=5, owner=6
--
-- Current sub_item_view "Catálogo" in Oportunidades:
--   foto=1, sku=2, descripcion=3, unit_price=4, cantidad=5, subtotal=6
-- Target:
--   foto=1, sku=2, descripcion=3, unit_price=4, cantidad=5, unidad=6, subtotal=7
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PART 1: Mark existing catalog cols as is_system + add unidad ──────────────

UPDATE board_columns bc
   SET is_system = true
  FROM boards b
 WHERE bc.board_id = b.id
   AND b.system_key = 'catalog'
   AND bc.col_key IN ('foto', 'sku', 'descripcion', 'unit_price');

-- shift owner (and anything after position 4) down by 1 to make room for unidad at 5
UPDATE board_columns bc
   SET position = bc.position + 1
  FROM boards b
 WHERE bc.board_id = b.id
   AND b.system_key = 'catalog'
   AND bc.position >= 5
   AND bc.col_key <> 'unidad';

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT b.id, 'unidad', 'Unidad', 'text', 5, true, '{}'::jsonb
  FROM boards b
 WHERE b.system_key = 'catalog'
   AND NOT EXISTS (
         SELECT 1 FROM board_columns bc
          WHERE bc.board_id = b.id AND bc.col_key = 'unidad'
       );

-- ── PART 2: Oportunidades "Catálogo" sub_item_columns ─────────────────────────
--   insert unidad at pos 6, bump subtotal to pos 7, mark all 7 as is_system

DO $$
DECLARE
  v_opp_id     uuid;
  v_catalog_id uuid;
  v_view_id    uuid;
BEGIN
  FOR v_opp_id, v_catalog_id IN
    SELECT opp.id, cat.id
      FROM boards opp
      JOIN boards cat ON cat.workspace_id = opp.workspace_id AND cat.system_key = 'catalog'
     WHERE opp.system_key = 'opportunities'
  LOOP
    SELECT id INTO v_view_id
      FROM sub_item_views
     WHERE board_id = v_opp_id
       AND type = 'native'
       AND (config->>'source_board_id')::uuid = v_catalog_id
     LIMIT 1;

    IF v_view_id IS NULL THEN CONTINUE; END IF;

    UPDATE sub_item_columns
       SET position = 7
     WHERE board_id = v_opp_id AND view_id = v_view_id AND col_key = 'subtotal';

    INSERT INTO sub_item_columns
      (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, is_system, settings)
    VALUES
      (v_opp_id, v_view_id, 'unidad', 'Unidad', 'text', 6, 'unidad', false, false, true, '{}'::jsonb)
    ON CONFLICT (board_id, col_key) DO NOTHING;

    UPDATE sub_item_columns
       SET is_system = true
     WHERE board_id = v_opp_id
       AND view_id  = v_view_id
       AND col_key IN ('foto', 'sku', 'descripcion', 'unit_price', 'cantidad', 'unidad', 'subtotal');
  END LOOP;
END $$;

-- ── PART 3: Update default template body for existing workspaces ──────────────
--   Set style_json.quote_config and clear body_json (frontend will rebuild).

UPDATE document_templates
   SET body_json = '[]'::jsonb,
       style_json = COALESCE(style_json, '{}'::jsonb) || jsonb_build_object(
         'quote_config', jsonb_build_object(
           'tableColumns',        jsonb_build_array('sku','descripcion','cantidad','unidad','unit_price','subtotal'),
           'showThumbnail',       true,
           'ivaRate',             0.16,
           'notes',               '',
           'showClientSignature', true,
           'showVendorSignature', true
         )
       )
 WHERE name = 'Cotización estándar';

-- ── PART 4: Rewrite seed_system_boards() for new workspaces ───────────────────

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

  v_opp_contacto_col_id         uuid;
  v_contacts_institucion_col_id uuid;
  v_quote_oportunidad_col_id    uuid;
  v_quote_contacto_col_id       uuid;
  v_quote_institucion_col_id    uuid;

  v_catalogo_view_id            uuid;
  v_default_template_id         uuid;
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

  -- Oportunidades
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

  -- Contactos
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_contacts_id, 'name',  'Nombre',   'text',   0, true, '{}'::jsonb),
    (v_contacts_id, 'phone', 'Teléfono', 'phone',  1, true, '{}'::jsonb),
    (v_contacts_id, 'email', 'Email',    'email',  2, true, '{}'::jsonb),
    (v_contacts_id, 'owner', 'Dueño',    'people', 3, true, '{"role":"owner"}'::jsonb);

  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
  VALUES (v_contacts_id, 'institucion', 'Institución', 'relation', 4, true,
          jsonb_build_object('target_board_id', v_accounts_id))
  RETURNING id INTO v_contacts_institucion_col_id;

  -- Instituciones
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_accounts_id, 'name',  'Nombre', 'text',   0, true, '{}'::jsonb),
    (v_accounts_id, 'type',  'Tipo',   'select', 1, true, '{}'::jsonb),
    (v_accounts_id, 'owner', 'Dueño',  'people', 2, true, '{"role":"owner"}'::jsonb);

  -- Proveedores
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_vendors_id, 'name',       'Nombre',       'text',   0, true, '{}'::jsonb),
    (v_vendors_id, 'legal_name', 'Razón social', 'text',   1, true, '{}'::jsonb),
    (v_vendors_id, 'tax_id',     'RFC',          'text',   2, true, '{}'::jsonb),
    (v_vendors_id, 'phone',      'Teléfono',     'phone',  3, true, '{}'::jsonb),
    (v_vendors_id, 'email',      'Email',        'email',  4, true, '{}'::jsonb),
    (v_vendors_id, 'owner',      'Responsable',  'people', 5, true, '{"role":"owner"}'::jsonb);

  -- Catálogo — todas las cols default son is_system (incluye unidad)
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_catalog_id, 'name',        'Nombre',           'text',   0, true, '{}'::jsonb),
    (v_catalog_id, 'foto',        'Foto',             'image',  1, true, jsonb_build_object('max_files', 1)),
    (v_catalog_id, 'sku',         'SKU',              'text',   2, true, '{}'::jsonb),
    (v_catalog_id, 'descripcion', 'Descripción',      'text',   3, true, '{}'::jsonb),
    (v_catalog_id, 'unit_price',  'Precio unitario',  'number', 4, true, '{"format":"currency"}'::jsonb),
    (v_catalog_id, 'unidad',      'Unidad',           'text',   5, true, '{}'::jsonb),
    (v_catalog_id, 'owner',       'Responsable',      'people', 6, true, '{"role":"owner"}'::jsonb);

  -- Cotizaciones
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

  -- Default template — body_json vacío, el frontend lo construye desde config
  INSERT INTO document_templates
    (workspace_id, name, target_board_id, body_json, style_json, signature_config, status, created_by)
  VALUES
    (p_workspace_id, 'Cotización estándar', v_opp_id,
     '[]'::jsonb,
     jsonb_build_object('quote_config', jsonb_build_object(
       'tableColumns',        jsonb_build_array('sku','descripcion','cantidad','unidad','unit_price','subtotal'),
       'showThumbnail',       true,
       'ivaRate',             0.16,
       'notes',               '',
       'showClientSignature', true,
       'showVendorSignature', true
     )),
     jsonb_build_array(
       jsonb_build_object('role','cliente','required',true),
       jsonb_build_object('role','vendedor','required',false,'auto_sign_by_owner',true)
     ),
     'active',
     NULL)
  RETURNING id INTO v_default_template_id;

  -- Default sub_item_views
  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_opp_id, p_workspace_id, 'Catálogo', 0, 'native',
      jsonb_build_object('source_board_id', v_catalog_id))
  RETURNING id INTO v_catalogo_view_id;

  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_opp_id, p_workspace_id, 'Cotizaciones', 1, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_oportunidad_col_id));

  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_contacts_id, p_workspace_id, 'Oportunidades', 0, 'board_items',
      jsonb_build_object('source_board_id', v_opp_id, 'relation_col_id', v_opp_contacto_col_id)),
    (v_contacts_id, p_workspace_id, 'Cotizaciones', 1, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_contacto_col_id));

  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_accounts_id, p_workspace_id, 'Contactos', 0, 'board_items',
      jsonb_build_object('source_board_id', v_contacts_id, 'relation_col_id', v_contacts_institucion_col_id)),
    (v_accounts_id, p_workspace_id, 'Cotizaciones', 1, 'board_items',
      jsonb_build_object('source_board_id', v_quotes_id, 'relation_col_id', v_quote_institucion_col_id));

  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_catalog_id, p_workspace_id, 'Variantes', 0, 'native', '{}'::jsonb);

  -- Sub_item_columns de Oportunidades "Catálogo" — 7 cols, todas is_system
  INSERT INTO sub_item_columns
    (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, is_system, settings)
  VALUES
    (v_opp_id, v_catalogo_view_id, 'foto',         'Foto',            'image',   1, 'foto',         false, false, true, '{"max_files":1}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'sku',          'SKU',             'text',    2, 'sku',          false, false, true, '{}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'descripcion',  'Descripción',     'text',    3, 'descripcion',  false, false, true, '{}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'unit_price',   'Precio unitario', 'number',  4, 'unit_price',   false, false, true, '{"format":"currency"}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'cantidad',     'Cantidad',        'number',  5, NULL,           false, false, true, '{"default_value":1}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'unidad',       'Unidad',          'text',    6, 'unidad',       false, false, true, '{}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'subtotal',     'Subtotal',        'formula', 7, NULL,           false, false, true, '{"formula":"multiply","col_a":"cantidad","col_b":"unit_price","format":"currency"}'::jsonb);

END;
$$;
