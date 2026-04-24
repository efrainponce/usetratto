-- ═══════════════════════════════════════════════════════════════════════════════
-- `documentos` board — unified home for everything that isn't a cotización
-- ═══════════════════════════════════════════════════════════════════════════════
-- Houses: factura, oc_cliente (PO received from customer), oc_proveedor (PO
-- sent to supplier), recepcion, devolucion, and future doc types.
--
-- Two discriminators:
--   doc_type   — factura | oc_cliente | oc_proveedor | recepcion | devolucion
--   direction  — outbound (we send) | inbound (we receive)
--
-- Stages are shared across doc types; a `settings.applies_to_doc_types` array
-- on each stage marks which ones it belongs to. UI filters stage dropdown by
-- the item's current doc_type.
--
-- Shares the Partidas pattern with cotizaciones: native view + snapshot RPC
-- will be added in a later migration.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PART 0: Add settings jsonb to board_stages (for applies_to_doc_types) ────

ALTER TABLE board_stages
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── PART 1: Create the board for existing workspaces ─────────────────────────

DO $$
DECLARE
  v_workspace_id uuid;
  v_docs_id      uuid;
  v_opp_id       uuid;
  v_contacts_id  uuid;
  v_accounts_id  uuid;
  v_vendors_id   uuid;

  v_docs_oportunidad_col_id uuid;
  v_docs_contacto_col_id    uuid;
  v_docs_institucion_col_id uuid;
  v_docs_proveedor_col_id   uuid;
  v_docs_partidas_view_id   uuid;

  v_unidad_options jsonb := jsonb_build_array(
    jsonb_build_object('value','pza',  'label','Pieza',          'color','#6B7280'),
    jsonb_build_object('value','caja', 'label','Caja',           'color','#F59E0B'),
    jsonb_build_object('value','kg',   'label','Kilogramo',      'color','#10B981'),
    jsonb_build_object('value','m',    'label','Metro',          'color','#3B82F6'),
    jsonb_build_object('value','m2',   'label','Metro cuadrado', 'color','#8B5CF6'),
    jsonb_build_object('value','par',  'label','Par',            'color','#EC4899'),
    jsonb_build_object('value','l',    'label','Litro',          'color','#06B6D4')
  );

  v_doc_type_options jsonb := jsonb_build_array(
    jsonb_build_object('value','factura',       'label','Factura',             'color','#10B981'),
    jsonb_build_object('value','oc_cliente',    'label','OC del cliente',      'color','#3B82F6'),
    jsonb_build_object('value','oc_proveedor',  'label','OC a proveedor',      'color','#8B5CF6'),
    jsonb_build_object('value','recepcion',     'label','Recepción',           'color','#F59E0B'),
    jsonb_build_object('value','devolucion',    'label','Devolución',          'color','#EF4444')
  );

  v_direction_options jsonb := jsonb_build_array(
    jsonb_build_object('value','outbound', 'label','Saliente', 'color','#8B5CF6'),
    jsonb_build_object('value','inbound',  'label','Entrante', 'color','#10B981')
  );
BEGIN
  FOR v_workspace_id IN SELECT id FROM workspaces LOOP
    -- Skip if already exists
    IF EXISTS (SELECT 1 FROM boards WHERE workspace_id = v_workspace_id AND system_key = 'documents') THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_opp_id      FROM boards WHERE workspace_id = v_workspace_id AND system_key = 'opportunities';
    SELECT id INTO v_contacts_id FROM boards WHERE workspace_id = v_workspace_id AND system_key = 'contacts';
    SELECT id INTO v_accounts_id FROM boards WHERE workspace_id = v_workspace_id AND system_key = 'accounts';
    SELECT id INTO v_vendors_id  FROM boards WHERE workspace_id = v_workspace_id AND system_key = 'vendors';

    IF v_opp_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO boards (workspace_id, slug, name, type, system_key)
    VALUES (v_workspace_id, 'documentos', 'Documentos', 'pipeline', 'documents')
    RETURNING id INTO v_docs_id;

    -- Stages — opinionated for CMP; applies_to_doc_types gates visibility per item
    INSERT INTO board_stages (board_id, name, color, position, is_closed, settings) VALUES
      -- Factura lifecycle
      (v_docs_id, 'Factura: borrador',     '#94A3B8', 0,  false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('factura'))),
      (v_docs_id, 'Factura: emitida',      '#3B82F6', 1,  false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('factura'))),
      (v_docs_id, 'Factura: pagada',       '#10B981', 2,  true,  jsonb_build_object('applies_to_doc_types', jsonb_build_array('factura'))),
      (v_docs_id, 'Factura: cancelada',    '#EF4444', 3,  true,  jsonb_build_object('applies_to_doc_types', jsonb_build_array('factura'))),
      -- OC cliente lifecycle
      (v_docs_id, 'OC cliente: recibida',  '#3B82F6', 4,  false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_cliente'))),
      (v_docs_id, 'OC cliente: validada',  '#10B981', 5,  false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_cliente'))),
      (v_docs_id, 'OC cliente: archivada', '#6B7280', 6,  true,  jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_cliente'))),
      -- OC proveedor lifecycle
      (v_docs_id, 'OC prov: borrador',     '#94A3B8', 7,  false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_proveedor'))),
      (v_docs_id, 'OC prov: emitida',      '#3B82F6', 8,  false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_proveedor'))),
      (v_docs_id, 'OC prov: confirmada',   '#8B5CF6', 9,  false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_proveedor'))),
      (v_docs_id, 'OC prov: en tránsito',  '#F59E0B', 10, false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_proveedor'))),
      (v_docs_id, 'OC prov: recibida',     '#10B981', 11, false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_proveedor'))),
      (v_docs_id, 'OC prov: pagada',       '#10B981', 12, true,  jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_proveedor'))),
      (v_docs_id, 'OC prov: cancelada',    '#EF4444', 13, true,  jsonb_build_object('applies_to_doc_types', jsonb_build_array('oc_proveedor'))),
      -- Recepción
      (v_docs_id, 'Recepción: borrador',   '#94A3B8', 14, false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('recepcion'))),
      (v_docs_id, 'Recepción: confirmada', '#10B981', 15, true,  jsonb_build_object('applies_to_doc_types', jsonb_build_array('recepcion'))),
      -- Devolución
      (v_docs_id, 'Devolución: borrador',  '#94A3B8', 16, false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('devolucion'))),
      (v_docs_id, 'Devolución: emitida',   '#F59E0B', 17, false, jsonb_build_object('applies_to_doc_types', jsonb_build_array('devolucion'))),
      (v_docs_id, 'Devolución: recibida',  '#10B981', 18, true,  jsonb_build_object('applies_to_doc_types', jsonb_build_array('devolucion')));

    -- Columns
    INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
      (v_docs_id, 'name',       'Nombre',    'text',   0, true, '{}'::jsonb),
      (v_docs_id, 'stage',      'Etapa',     'select', 1, true, '{"role":"primary_stage"}'::jsonb),
      (v_docs_id, 'doc_type',   'Tipo',      'select', 2, true, jsonb_build_object('options', v_doc_type_options, 'required', true)),
      (v_docs_id, 'direction',  'Dirección', 'select', 3, true, jsonb_build_object('options', v_direction_options));

    INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
    VALUES (v_docs_id, 'oportunidad', 'Oportunidad', 'relation', 4, true,
            jsonb_build_object('target_board_id', v_opp_id, 'required', true))
    RETURNING id INTO v_docs_oportunidad_col_id;

    INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
    VALUES (v_docs_id, 'contacto', 'Contacto', 'relation', 5, true,
            jsonb_build_object('target_board_id', v_contacts_id))
    RETURNING id INTO v_docs_contacto_col_id;

    INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
    VALUES (v_docs_id, 'institucion', 'Institución', 'relation', 6, true,
            jsonb_build_object('target_board_id', v_accounts_id))
    RETURNING id INTO v_docs_institucion_col_id;

    INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
    VALUES (v_docs_id, 'proveedor', 'Proveedor', 'relation', 7, true,
            jsonb_build_object('target_board_id', v_vendors_id))
    RETURNING id INTO v_docs_proveedor_col_id;

    INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings) VALUES
      (v_docs_id, 'monto',         'Monto',         'number', 8,  true, '{"format":"currency"}'::jsonb),
      (v_docs_id, 'pdf_url',       'PDF',           'file',   10, true, '{}'::jsonb),
      (v_docs_id, 'fecha_entrega', 'Fecha entrega', 'date',   11, true, '{}'::jsonb),
      (v_docs_id, 'generated_by',  'Generado por',  'people', 12, true, '{}'::jsonb);

    -- Set folio prefix for documents (trigger already created the folio col)
    UPDATE boards SET folio_prefix = 'DOC' WHERE id = v_docs_id AND folio_prefix = 'ITEM';

    -- Partidas view (same pattern as cotizaciones)
    INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config)
    VALUES (v_docs_id, v_workspace_id, 'Partidas', 0, 'native', '{}'::jsonb)
    RETURNING id INTO v_docs_partidas_view_id;

    INSERT INTO sub_item_columns
      (board_id, view_id, col_key, name, kind, position, source_col_key, is_hidden, required, settings)
    VALUES
      (v_docs_id, v_docs_partidas_view_id, 'sku',          'SKU',             'text',    1, NULL, false, false, '{}'::jsonb),
      (v_docs_id, v_docs_partidas_view_id, 'cantidad',     'Cantidad',        'number',  2, NULL, false, false, '{"default_value":1}'::jsonb),
      (v_docs_id, v_docs_partidas_view_id, 'unit_price',   'Precio unitario', 'number',  3, NULL, false, false, '{"format":"currency"}'::jsonb),
      (v_docs_id, v_docs_partidas_view_id, 'descripcion',  'Descripción',     'text',    4, NULL, false, false, '{}'::jsonb),
      (v_docs_id, v_docs_partidas_view_id, 'unidad',       'Unidad',          'select',  5, NULL, false, false, jsonb_build_object('options', v_unidad_options)),
      (v_docs_id, v_docs_partidas_view_id, 'foto',         'Imagen',          'file',    6, NULL, false, false, '{"max_files":1}'::jsonb),
      (v_docs_id, v_docs_partidas_view_id, 'subtotal',     'Subtotal',        'formula', 7, NULL, false, false, '{"formula":"multiply","col_a":"cantidad","col_b":"unit_price","format":"currency"}'::jsonb);

    -- Reflejos: Documentos tab on opp, contact, institucion, proveedor
    INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
      (v_opp_id,      v_workspace_id, 'Documentos', 2, 'board_items', jsonb_build_object('source_board_id', v_docs_id, 'relation_col_id', v_docs_oportunidad_col_id));

    INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
      (v_contacts_id, v_workspace_id, 'Documentos', 2, 'board_items', jsonb_build_object('source_board_id', v_docs_id, 'relation_col_id', v_docs_contacto_col_id));

    INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
      (v_accounts_id, v_workspace_id, 'Documentos', 3, 'board_items', jsonb_build_object('source_board_id', v_docs_id, 'relation_col_id', v_docs_institucion_col_id));

    -- Proveedores: add Documentos ref view (first for this board)
    IF v_vendors_id IS NOT NULL THEN
      INSERT INTO sub_item_views (board_id, workspace_id, name, position, type, config) VALUES
        (v_vendors_id, v_workspace_id, 'Documentos', 0, 'board_items', jsonb_build_object('source_board_id', v_docs_id, 'relation_col_id', v_docs_proveedor_col_id));
    END IF;
  END LOOP;
END $$;
