-- =============================================================================
-- Dummy data seed for CMP workspace
-- 20 rows per board: Instituciones, Contactos, Proveedores, Catálogo, Oportunidades
-- Cotizaciones intentionally empty (generated via template flow)
-- =============================================================================

DO $$
DECLARE
  v_ws uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_owner uuid;

  -- Board ids
  v_opp_b   uuid;
  v_ct_b    uuid;
  v_inst_b  uuid;
  v_ven_b   uuid;
  v_cat_b   uuid;

  -- Column ids (cached)
  c_opp_stage     uuid;
  c_opp_contacto  uuid;
  c_opp_inst      uuid;
  c_opp_monto     uuid;
  c_opp_deadline  uuid;

  c_ct_phone      uuid;
  c_ct_email      uuid;
  c_ct_inst       uuid;

  c_inst_type     uuid;

  c_ven_legal     uuid;
  c_ven_tax       uuid;
  c_ven_phone     uuid;
  c_ven_email     uuid;

  c_cat_desc      uuid;
  c_cat_foto      uuid;
  c_cat_price     uuid;

  -- Stage ids
  v_stage_nueva      uuid;
  v_stage_cotizacion uuid;
  v_stage_presentada uuid;
  v_stage_cerrada    uuid;
  v_stages uuid[];

  -- Collected ids
  v_inst_ids   uuid[] := ARRAY[]::uuid[];
  v_contact_ids uuid[] := ARRAY[]::uuid[];
  v_catalog_ids uuid[] := ARRAY[]::uuid[];

  v_tmp uuid;
  i int;

  -- Data arrays
  inst_names text[] := ARRAY[
    'Hospital General de México','UNAM','IPN',
    'Gobierno del Estado de Jalisco','Secretaría de Salud','Hospital ABC',
    'Tec de Monterrey','PEMEX','CFE','Universidad Anáhuac',
    'IMSS','ISSSTE','Hospital Ángeles','Grupo Modelo','Cemex',
    'BBVA México','Universidad La Salle','FEMSA','Hospital Médica Sur','SEP'
  ];
  inst_types text[] := ARRAY[
    'Hospital','Universidad','Universidad',
    'Gobierno','Gobierno','Hospital',
    'Universidad','Empresa','Gobierno','Universidad',
    'Gobierno','Gobierno','Hospital','Empresa','Empresa',
    'Empresa','Universidad','Empresa','Hospital','Gobierno'
  ];

  contact_first text[] := ARRAY[
    'Juan','María','Carlos','Ana Sofía','Roberto',
    'Laura','Jorge Luis','Patricia','Miguel Ángel','Gabriela',
    'Fernando','Valeria','Ricardo','Daniela','Alejandro',
    'Fernanda','Héctor','Mónica','Diego','Claudia'
  ];
  contact_last text[] := ARRAY[
    'Pérez García','Rodríguez López','Hernández Martínez','González Salinas','Sánchez Ruiz',
    'Martínez Torres','Ramírez Flores','Flores Díaz','Herrera Castillo','Mendoza Vega',
    'Ortiz Vázquez','Castro Medina','Jiménez Morales','Vargas Romero','Morales Silva',
    'Ruiz Fuentes','Domínguez Peña','Espinoza León','Navarro Robles','Rivera Campos'
  ];

  vendor_names text[] := ARRAY[
    'Uniformes del Norte SA','Textiles Industriales Monterrey','Distribuidora Médica Nacional',
    'Equipos Hospitalarios MX','Papelería La Favorita','Insumos Escolares SA',
    'Tácticos del Pacífico','Bordados Jalisco','Telas y Fibras CDMX','Industrial Serrano',
    'Confecciones Veracruz','Suministros del Bajío','Distribuidora Azteca','Mayorista El Sol',
    'Importadora Coyoacán','Uniformes Monarca','Texproveedor del Sur','Industrial Querétaro',
    'Bordadora Puebla','Confecciones del Golfo'
  ];

  catalog_names text[] := ARRAY[
    'Chamarra táctica','Pantalón cargo','Camisa polo bordada','Botas tácticas militares','Gorra con logo',
    'Chaleco multifuncional','Camisola manga larga','Pantalón de vestir','Camisa blanca formal','Chaleco reflectante',
    'Suéter institucional','Falda escolar','Blusa bordada','Saco de vestir','Playera deportiva',
    'Short deportivo','Uniforme quirúrgico','Bata médica','Casco de seguridad','Overol industrial'
  ];
  catalog_descs text[] := ARRAY[
    'Chamarra de poliéster reforzado con bolsas internas','Pantalón tipo cargo con múltiples bolsas laterales',
    'Polo de algodón piqué con logo bordado en pecho','Botas con suela antiderrapante y protección al tobillo',
    'Gorra tipo trucker con logo institucional bordado',
    'Chaleco con múltiples portaherramientas ajustable','Camisola de popelina con manga larga y bolsillo',
    'Pantalón de gabardina corte recto','Camisa 100% algodón cuello italiano','Chaleco naranja con cintas reflejantes',
    'Suéter tejido con logo de la institución','Falda escolar cuadros azul marino','Blusa blanca con bordado en cuello',
    'Saco de vestir corte clásico','Playera 100% algodón con logo deportivo','Short transpirable talla universal',
    'Conjunto quirúrgico con pantalón y filipina','Bata de laboratorio manga larga','Casco tipo V con barbiquejo',
    'Overol industrial con reflejantes y cierres metálicos'
  ];
  catalog_prices numeric[] := ARRAY[
    2400, 890, 420, 1850, 280,
    1150, 510, 780, 640, 380,
    820, 450, 390, 1550, 260,
    220, 890, 620, 450, 1380
  ];

  opp_prefixes text[] := ARRAY[
    'Contrato 2026','Licitación Q2','Renovación anual','Uniformes generales','Equipo médico',
    'Dotación invierno','Suministro escolar','Contrato marco','Proyecto especial','Uniformes administrativos',
    'Pedido emergente','Acuerdo trianual','Contrato anual','Suministro inicial','Renovación flota',
    'Pedido especial','Dotación verano','Proyecto piloto','Contrato multi-sede','Compra directa'
  ];

  opp_montos numeric[] := ARRAY[
    285000,450000,125000,780000,920000,
    340000,150000,1250000,420000,680000,
    95000,1890000,560000,320000,720000,
    180000,250000,410000,890000,135000
  ];

BEGIN
  -- Disable triggers to avoid activity spam during seed
  SET LOCAL session_replication_role = replica;

  SELECT id INTO v_owner FROM users WHERE workspace_id = v_ws LIMIT 1;

  SELECT id INTO v_opp_b  FROM boards WHERE workspace_id=v_ws AND system_key='opportunities';
  SELECT id INTO v_ct_b   FROM boards WHERE workspace_id=v_ws AND system_key='contacts';
  SELECT id INTO v_inst_b FROM boards WHERE workspace_id=v_ws AND system_key='accounts';
  SELECT id INTO v_ven_b  FROM boards WHERE workspace_id=v_ws AND system_key='vendors';
  SELECT id INTO v_cat_b  FROM boards WHERE workspace_id=v_ws AND system_key='catalog';

  -- Column ids
  SELECT id INTO c_opp_stage    FROM board_columns WHERE board_id=v_opp_b AND col_key='stage';
  SELECT id INTO c_opp_contacto FROM board_columns WHERE board_id=v_opp_b AND col_key='contacto';
  SELECT id INTO c_opp_inst     FROM board_columns WHERE board_id=v_opp_b AND col_key='institucion';
  SELECT id INTO c_opp_monto    FROM board_columns WHERE board_id=v_opp_b AND col_key='monto';
  SELECT id INTO c_opp_deadline FROM board_columns WHERE board_id=v_opp_b AND col_key='deadline';

  SELECT id INTO c_ct_phone FROM board_columns WHERE board_id=v_ct_b AND col_key='phone';
  SELECT id INTO c_ct_email FROM board_columns WHERE board_id=v_ct_b AND col_key='email';
  SELECT id INTO c_ct_inst  FROM board_columns WHERE board_id=v_ct_b AND col_key='institucion';

  SELECT id INTO c_inst_type FROM board_columns WHERE board_id=v_inst_b AND col_key='type';

  SELECT id INTO c_ven_legal FROM board_columns WHERE board_id=v_ven_b AND col_key='legal_name';
  SELECT id INTO c_ven_tax   FROM board_columns WHERE board_id=v_ven_b AND col_key='tax_id';
  SELECT id INTO c_ven_phone FROM board_columns WHERE board_id=v_ven_b AND col_key='phone';
  SELECT id INTO c_ven_email FROM board_columns WHERE board_id=v_ven_b AND col_key='email';

  SELECT id INTO c_cat_desc  FROM board_columns WHERE board_id=v_cat_b AND col_key='descripcion';
  SELECT id INTO c_cat_foto  FROM board_columns WHERE board_id=v_cat_b AND col_key='foto';
  SELECT id INTO c_cat_price FROM board_columns WHERE board_id=v_cat_b AND col_key='unit_price';

  -- Stages
  SELECT id INTO v_stage_nueva      FROM board_stages WHERE board_id=v_opp_b AND name='Nueva';
  SELECT id INTO v_stage_cotizacion FROM board_stages WHERE board_id=v_opp_b AND name='Cotización';
  SELECT id INTO v_stage_presentada FROM board_stages WHERE board_id=v_opp_b AND name='Presentada';
  SELECT id INTO v_stage_cerrada    FROM board_stages WHERE board_id=v_opp_b AND name='Cerrada';
  v_stages := ARRAY[v_stage_nueva, v_stage_cotizacion, v_stage_presentada, v_stage_cerrada];

  -- ── 20 Instituciones ─────────────────────────────────────────────────────
  FOR i IN 1..20 LOOP
    INSERT INTO items (workspace_id, board_id, name, owner_id)
    VALUES (v_ws, v_inst_b, inst_names[i], v_owner)
    RETURNING id INTO v_tmp;
    v_inst_ids := array_append(v_inst_ids, v_tmp);

    INSERT INTO item_values (item_id, column_id, value_text)
    VALUES (v_tmp, c_inst_type, inst_types[i]);
  END LOOP;

  -- ── 20 Contactos (cada uno ligado a una institución) ────────────────────
  FOR i IN 1..20 LOOP
    INSERT INTO items (workspace_id, board_id, name, owner_id)
    VALUES (v_ws, v_ct_b, contact_first[i] || ' ' || contact_last[i], v_owner)
    RETURNING id INTO v_tmp;
    v_contact_ids := array_append(v_contact_ids, v_tmp);

    -- phone: +52 55 formato pseudo-random estable por índice
    INSERT INTO item_values (item_id, column_id, value_text)
    VALUES (v_tmp, c_ct_phone, '+52 55 ' || LPAD((1000 + i * 137)::text, 4, '0') || ' ' || LPAD((2000 + i * 211)::text, 4, '0'));

    -- email
    INSERT INTO item_values (item_id, column_id, value_text)
    VALUES (v_tmp, c_ct_email, LOWER(REPLACE(REPLACE(contact_first[i], ' ', ''), 'Á','A') || '.' || SPLIT_PART(contact_last[i], ' ', 1)) || '@tratto.dev');

    -- institucion FK
    INSERT INTO item_values (item_id, column_id, value_text)
    VALUES (v_tmp, c_ct_inst, v_inst_ids[i]::text);
  END LOOP;

  -- ── 20 Proveedores ──────────────────────────────────────────────────────
  FOR i IN 1..20 LOOP
    INSERT INTO items (workspace_id, board_id, name, owner_id)
    VALUES (v_ws, v_ven_b, vendor_names[i], v_owner)
    RETURNING id INTO v_tmp;

    INSERT INTO item_values (item_id, column_id, value_text) VALUES
      (v_tmp, c_ven_legal, vendor_names[i] || ' de C.V.'),
      (v_tmp, c_ven_tax,   'PRV' || LPAD(i::text, 6, '0') || 'XX' || (i*3)::text),
      (v_tmp, c_ven_phone, '+52 33 ' || LPAD((3000 + i * 179)::text, 4, '0') || ' ' || LPAD((5000 + i * 223)::text, 4, '0')),
      (v_tmp, c_ven_email, 'ventas' || i::text || '@' || LOWER(SPLIT_PART(vendor_names[i], ' ', 1)) || '.mx');
  END LOOP;

  -- ── 20 Productos (Catálogo) ─────────────────────────────────────────────
  FOR i IN 1..20 LOOP
    INSERT INTO items (workspace_id, board_id, name, owner_id)
    VALUES (v_ws, v_cat_b, catalog_names[i], v_owner)
    RETURNING id INTO v_tmp;
    v_catalog_ids := array_append(v_catalog_ids, v_tmp);

    INSERT INTO item_values (item_id, column_id, value_text) VALUES
      (v_tmp, c_cat_desc, catalog_descs[i]);

    -- foto: JSON array estilo FileCell con URL de picsum (estable por seed)
    INSERT INTO item_values (item_id, column_id, value_json) VALUES
      (v_tmp, c_cat_foto, jsonb_build_array(jsonb_build_object(
        'url', 'https://picsum.photos/seed/tratto-' || i::text || '/600/400',
        'name', 'foto.jpg',
        'type', 'image/jpeg',
        'size', 50000
      )));

    INSERT INTO item_values (item_id, column_id, value_number)
    VALUES (v_tmp, c_cat_price, catalog_prices[i]);
  END LOOP;

  -- ── 20 Oportunidades (con contacto + institución + stage + monto + deadline) ─
  FOR i IN 1..20 LOOP
    INSERT INTO items (workspace_id, board_id, name, owner_id, stage_id, deadline)
    VALUES (
      v_ws, v_opp_b,
      opp_prefixes[i] || ' · ' || inst_names[1 + ((i * 7) % 20)],
      v_owner,
      v_stages[1 + ((i - 1) % 4)],   -- 5 por stage
      (now() + ((i * 4) || ' days')::interval)::date
    )
    RETURNING id INTO v_tmp;

    -- contacto + institucion (relations espaciados)
    INSERT INTO item_values (item_id, column_id, value_text) VALUES
      (v_tmp, c_opp_contacto, v_contact_ids[1 + ((i * 3) % 20)]::text),
      (v_tmp, c_opp_inst,     v_inst_ids[1 + ((i * 7) % 20)]::text);

    INSERT INTO item_values (item_id, column_id, value_number)
    VALUES (v_tmp, c_opp_monto, opp_montos[i]);
  END LOOP;

END $$;
