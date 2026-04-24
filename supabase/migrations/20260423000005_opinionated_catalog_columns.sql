-- ═══════════════════════════════════════════════════════════════════════════════
-- Opinionated Catálogo columns
-- ═══════════════════════════════════════════════════════════════════════════════
-- Shape the default product catalog + its downstream views so a new customer
-- starts with something usable without configuring anything:
--
--   Catálogo (board)                    → name, sku, descripcion, unidad, foto, unit_price, owner
--   Catálogo (sub_item_view on Opp)     → sku, cantidad, unit_price, descripcion, unidad, foto, subtotal
--   Partidas (sub_item_view on Quote)   → same shape (snapshot target)
--
-- Mapping rules on the Opp's Catálogo view:
--   · SKU, Descripción, Unidad, Imagen → source-mapped (auto-pulled from catalog)
--   · Cantidad, Precio unitario        → manual (per-opp, per-deal)
--   · Subtotal                         → formula (cantidad × unit_price)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PART 0: Add `proveedor` relation column to Catálogo in existing workspaces ─

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT
  cat.id,
  'proveedor',
  'Proveedor',
  'relation',
  7,
  false,
  jsonb_build_object('target_board_id', ven.id)
FROM boards cat
JOIN boards ven ON ven.workspace_id = cat.workspace_id AND ven.system_key = 'vendors'
WHERE cat.system_key = 'catalog'
  AND NOT EXISTS (
    SELECT 1 FROM board_columns bc WHERE bc.board_id = cat.id AND bc.col_key = 'proveedor'
  );

-- ── PART 1: Add `unidad` column to Catálogo board in existing workspaces ──────

INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
SELECT b.id, 'unidad', 'Unidad', 'select', 3, false,
       jsonb_build_object('options', jsonb_build_array(
         jsonb_build_object('value','pza',  'label','Pieza',          'color','#6B7280'),
         jsonb_build_object('value','caja', 'label','Caja',           'color','#F59E0B'),
         jsonb_build_object('value','kg',   'label','Kilogramo',      'color','#10B981'),
         jsonb_build_object('value','m',    'label','Metro',          'color','#3B82F6'),
         jsonb_build_object('value','m2',   'label','Metro cuadrado', 'color','#8B5CF6'),
         jsonb_build_object('value','par',  'label','Par',            'color','#EC4899'),
         jsonb_build_object('value','l',    'label','Litro',          'color','#06B6D4')
       ))
FROM boards b
WHERE b.system_key = 'catalog'
  AND NOT EXISTS (
    SELECT 1 FROM board_columns bc WHERE bc.board_id = b.id AND bc.col_key = 'unidad'
  );

-- ── PART 2: Reshape existing Catálogo sub_item_view on Opp boards ─────────────
--
-- Desired final state (in order):
--   pos 1 = sku          source='sku'
--   pos 2 = cantidad     manual (default 1)
--   pos 3 = unit_price   manual
--   pos 4 = descripcion  source='descripcion'
--   pos 5 = unidad       source='unidad'         ← may need to be created
--   pos 6 = foto         source='foto'
--   pos 7 = subtotal     formula (cantidad × unit_price)

DO $$
DECLARE
  v_workspace_id uuid;
  v_opp_id       uuid;
  v_catalog_id   uuid;
  v_view_id      uuid;
BEGIN
  FOR v_workspace_id, v_opp_id, v_catalog_id IN
    SELECT w.id, opp.id, cat.id
    FROM workspaces w
    JOIN boards opp ON opp.workspace_id = w.id AND opp.system_key = 'opportunities'
    JOIN boards cat ON cat.workspace_id = w.id AND cat.system_key = 'catalog'
  LOOP
    SELECT id INTO v_view_id
    FROM sub_item_views
    WHERE board_id = v_opp_id
      AND type = 'native'
      AND (config->>'source_board_id')::uuid = v_catalog_id
    LIMIT 1;

    IF v_view_id IS NULL THEN CONTINUE; END IF;

    -- Make unit_price a manual column (strip source mapping)
    UPDATE sub_item_columns
    SET source_col_key = NULL, position = 3
    WHERE board_id = v_opp_id AND view_id = v_view_id AND col_key = 'unit_price';

    -- Reposition existing columns
    UPDATE sub_item_columns SET position = 1 WHERE board_id = v_opp_id AND view_id = v_view_id AND col_key = 'sku';
    UPDATE sub_item_columns SET position = 2 WHERE board_id = v_opp_id AND view_id = v_view_id AND col_key = 'cantidad';
    UPDATE sub_item_columns SET position = 4 WHERE board_id = v_opp_id AND view_id = v_view_id AND col_key = 'descripcion';
    UPDATE sub_item_columns SET position = 6 WHERE board_id = v_opp_id AND view_id = v_view_id AND col_key = 'foto';
    UPDATE sub_item_columns SET position = 7 WHERE board_id = v_opp_id AND view_id = v_view_id AND col_key = 'subtotal';

    -- Insert `unidad` if missing
    INSERT INTO sub_item_columns
      (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, settings)
    VALUES
      (v_opp_id, v_view_id, 'unidad', 'Unidad', 'select', 5, 'unidad', false, false,
       jsonb_build_object('options', jsonb_build_array(
         jsonb_build_object('value','pza',  'label','Pieza',          'color','#6B7280'),
         jsonb_build_object('value','caja', 'label','Caja',           'color','#F59E0B'),
         jsonb_build_object('value','kg',   'label','Kilogramo',      'color','#10B981'),
         jsonb_build_object('value','m',    'label','Metro',          'color','#3B82F6'),
         jsonb_build_object('value','m2',   'label','Metro cuadrado', 'color','#8B5CF6'),
         jsonb_build_object('value','par',  'label','Par',            'color','#EC4899'),
         jsonb_build_object('value','l',    'label','Litro',          'color','#06B6D4')
       )))
    ON CONFLICT (board_id, col_key) DO UPDATE
      SET view_id = EXCLUDED.view_id,
          position = EXCLUDED.position,
          source_col_key = EXCLUDED.source_col_key,
          kind = EXCLUDED.kind,
          settings = EXCLUDED.settings;
  END LOOP;
END $$;

-- ── PART 3: Reshape Partidas sub_item_view on Cotizaciones boards ─────────────
-- Same shape as Catálogo view, but every column is manual (no source) because
-- Partidas is the snapshot target — values are copied 1:1 by col_key in the RPC.

DO $$
DECLARE
  v_workspace_id uuid;
  v_quotes_id    uuid;
  v_view_id      uuid;
BEGIN
  FOR v_workspace_id, v_quotes_id IN
    SELECT workspace_id, id FROM boards WHERE system_key = 'quotes'
  LOOP
    SELECT id INTO v_view_id
    FROM sub_item_views
    WHERE board_id = v_quotes_id AND type = 'native' AND name = 'Partidas'
    LIMIT 1;

    IF v_view_id IS NULL THEN CONTINUE; END IF;

    -- Reposition existing columns
    UPDATE sub_item_columns SET position = 1 WHERE board_id = v_quotes_id AND view_id = v_view_id AND col_key = 'sku';
    UPDATE sub_item_columns SET position = 2 WHERE board_id = v_quotes_id AND view_id = v_view_id AND col_key = 'cantidad';
    UPDATE sub_item_columns SET position = 3 WHERE board_id = v_quotes_id AND view_id = v_view_id AND col_key = 'unit_price';
    UPDATE sub_item_columns SET position = 4 WHERE board_id = v_quotes_id AND view_id = v_view_id AND col_key = 'descripcion';
    UPDATE sub_item_columns SET position = 6 WHERE board_id = v_quotes_id AND view_id = v_view_id AND col_key = 'foto';
    UPDATE sub_item_columns SET position = 7 WHERE board_id = v_quotes_id AND view_id = v_view_id AND col_key = 'subtotal';

    INSERT INTO sub_item_columns
      (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, settings)
    VALUES
      (v_quotes_id, v_view_id, 'unidad', 'Unidad', 'select', 5, NULL, false, false,
       jsonb_build_object('options', jsonb_build_array(
         jsonb_build_object('value','pza',  'label','Pieza',          'color','#6B7280'),
         jsonb_build_object('value','caja', 'label','Caja',           'color','#F59E0B'),
         jsonb_build_object('value','kg',   'label','Kilogramo',      'color','#10B981'),
         jsonb_build_object('value','m',    'label','Metro',          'color','#3B82F6'),
         jsonb_build_object('value','m2',   'label','Metro cuadrado', 'color','#8B5CF6'),
         jsonb_build_object('value','par',  'label','Par',            'color','#EC4899'),
         jsonb_build_object('value','l',    'label','Litro',          'color','#06B6D4')
       )))
    ON CONFLICT (board_id, col_key) DO UPDATE
      SET view_id = EXCLUDED.view_id,
          position = EXCLUDED.position,
          kind = EXCLUDED.kind,
          settings = EXCLUDED.settings;
  END LOOP;
END $$;

-- ── PART 4: Update seed_system_boards() for new workspaces ─────────────────────

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
  v_partidas_view_id            uuid;
  v_default_template_id         uuid;

  v_unidad_options jsonb := jsonb_build_array(
    jsonb_build_object('value','pza',  'label','Pieza',          'color','#6B7280'),
    jsonb_build_object('value','caja', 'label','Caja',           'color','#F59E0B'),
    jsonb_build_object('value','kg',   'label','Kilogramo',      'color','#10B981'),
    jsonb_build_object('value','m',    'label','Metro',          'color','#3B82F6'),
    jsonb_build_object('value','m2',   'label','Metro cuadrado', 'color','#8B5CF6'),
    jsonb_build_object('value','par',  'label','Par',            'color','#EC4899'),
    jsonb_build_object('value','l',    'label','Litro',          'color','#06B6D4')
  );
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

  -- Catálogo (con unidad + proveedor)
  INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
    (v_catalog_id, 'name',        'Nombre',          'text',     0, true,  '{}'::jsonb),
    (v_catalog_id, 'sku',         'SKU',             'text',     1, false, '{}'::jsonb),
    (v_catalog_id, 'descripcion', 'Descripción',     'text',     2, false, '{}'::jsonb),
    (v_catalog_id, 'unidad',      'Unidad',          'select',   3, false, jsonb_build_object('options', v_unidad_options)),
    (v_catalog_id, 'foto',        'Foto',            'file',     4, false, jsonb_build_object('max_files', 1)),
    (v_catalog_id, 'unit_price',  'Precio unitario', 'number',   5, false, '{"format":"currency"}'::jsonb),
    (v_catalog_id, 'owner',       'Responsable',     'people',   6, true,  '{"role":"owner"}'::jsonb),
    (v_catalog_id, 'proveedor',   'Proveedor',       'relation', 7, false, jsonb_build_object('target_board_id', v_vendors_id));

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

  -- Default template (unchanged)
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

  -- Sub-item views
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

  INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
    (v_quotes_id, p_workspace_id, 'Partidas', 0, 'native', '{}'::jsonb)
  RETURNING id INTO v_partidas_view_id;

  -- Catálogo view on Opp: SKU, Cantidad, Precio (manual), Descripción, Unidad, Imagen, Subtotal
  INSERT INTO sub_item_columns
    (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, settings)
  VALUES
    (v_opp_id, v_catalogo_view_id, 'sku',          'SKU',             'text',    1, 'sku',         false, false, '{}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'cantidad',     'Cantidad',        'number',  2, NULL,          false, false, '{"default_value":1}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'unit_price',   'Precio unitario', 'number',  3, NULL,          false, false, '{"format":"currency"}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'descripcion',  'Descripción',     'text',    4, 'descripcion', false, false, '{}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'unidad',       'Unidad',          'select',  5, 'unidad',      false, false, jsonb_build_object('options', v_unidad_options)),
    (v_opp_id, v_catalogo_view_id, 'foto',         'Imagen',          'file',    6, 'foto',        false, false, '{"max_files":1}'::jsonb),
    (v_opp_id, v_catalogo_view_id, 'subtotal',     'Subtotal',        'formula', 7, NULL,          false, false, '{"formula":"multiply","col_a":"cantidad","col_b":"unit_price","format":"currency"}'::jsonb);

  -- Partidas view on Quote: same col_keys (snapshot target — all manual)
  INSERT INTO sub_item_columns
    (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, settings)
  VALUES
    (v_quotes_id, v_partidas_view_id, 'sku',          'SKU',             'text',    1, NULL, false, false, '{}'::jsonb),
    (v_quotes_id, v_partidas_view_id, 'cantidad',     'Cantidad',        'number',  2, NULL, false, false, '{"default_value":1}'::jsonb),
    (v_quotes_id, v_partidas_view_id, 'unit_price',   'Precio unitario', 'number',  3, NULL, false, false, '{"format":"currency"}'::jsonb),
    (v_quotes_id, v_partidas_view_id, 'descripcion',  'Descripción',     'text',    4, NULL, false, false, '{}'::jsonb),
    (v_quotes_id, v_partidas_view_id, 'unidad',       'Unidad',          'select',  5, NULL, false, false, jsonb_build_object('options', v_unidad_options)),
    (v_quotes_id, v_partidas_view_id, 'foto',         'Imagen',          'file',    6, NULL, false, false, '{"max_files":1}'::jsonb),
    (v_quotes_id, v_partidas_view_id, 'subtotal',     'Subtotal',        'formula', 7, NULL, false, false, '{"formula":"multiply","col_a":"cantidad","col_b":"unit_price","format":"currency"}'::jsonb);

END;
$$;
