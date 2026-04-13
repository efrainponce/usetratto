-- =============================================================================
-- 004_seed_data.sql
-- Tratto — data de ejemplo para desarrollo
-- Workspace: CMP
-- NOTA: No insertamos en auth.users — el trigger handle_new_auth_user crea
--       el profile en public.users cuando el admin hace su primer OTP login.
--       Después del primer login, ejecutar manualmente:
--         UPDATE users SET workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001',
--                          role = 'admin'
--         WHERE phone = '+521234567890';
-- =============================================================================

DO $$
DECLARE
  v_workspace_id    uuid := 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;
  v_team_ventas_id  uuid := 'cccccccc-0000-0000-0000-000000000001'::uuid;
  v_team_compras_id uuid := 'cccccccc-0000-0000-0000-000000000002'::uuid;
  v_terr_norte_id   uuid := 'dddddddd-0000-0000-0000-000000000001'::uuid;
  v_terr_centro_id  uuid := 'dddddddd-0000-0000-0000-000000000002'::uuid;
  v_terr_sur_id     uuid := 'dddddddd-0000-0000-0000-000000000003'::uuid;

  v_opp_board_id      uuid;
  v_contacts_board_id uuid;
  v_accounts_board_id uuid;
  v_catalog_board_id  uuid;

  v_stage_nueva_id uuid;
  v_stage_cot_id   uuid;
  v_stage_cost_id  uuid;
  v_stage_pres_id  uuid;
  v_stage_cerr_id  uuid;

  v_names text[] := ARRAY[
    'Uniforme táctico completo','Chaleco táctico','Bota táctica',
    'Casco balístico','Guantes de combate','Cinturón de servicio',
    'Mochila de asalto','Rodilleras tácticas','Gafas balísticas','Radio portátil'
  ];
  v_opp_names text[] := ARRAY[
    'SEDENA lote Q1','GN uniformes Q2','SSP equipamiento',
    'PF chalecos 500u','Marina botas 200u','Ejército gorras 1000u',
    'SSPE radios 50u','Policía Federal guantes','GN cascos 100u','CNDH uniformes'
  ];
  i integer;
BEGIN

  -- ── 1. WORKSPACE ──────────────────────────────────────────────────────────
  INSERT INTO workspaces (id, name)
  VALUES (v_workspace_id, 'CMP')
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. SYSTEM BOARDS ──────────────────────────────────────────────────────
  PERFORM seed_system_boards(v_workspace_id);

  SELECT id INTO v_opp_board_id      FROM boards WHERE workspace_id = v_workspace_id AND slug = 'oportunidades';
  SELECT id INTO v_contacts_board_id FROM boards WHERE workspace_id = v_workspace_id AND slug = 'contactos';
  SELECT id INTO v_accounts_board_id FROM boards WHERE workspace_id = v_workspace_id AND slug = 'cuentas';
  SELECT id INTO v_catalog_board_id  FROM boards WHERE workspace_id = v_workspace_id AND slug = 'catalogo';

  SELECT id INTO v_stage_nueva_id FROM board_stages WHERE board_id = v_opp_board_id AND name = 'Nueva';
  SELECT id INTO v_stage_cot_id   FROM board_stages WHERE board_id = v_opp_board_id AND name = 'Cotización';
  SELECT id INTO v_stage_cost_id  FROM board_stages WHERE board_id = v_opp_board_id AND name = 'Costeo';
  SELECT id INTO v_stage_pres_id  FROM board_stages WHERE board_id = v_opp_board_id AND name = 'Presentada';
  SELECT id INTO v_stage_cerr_id  FROM board_stages WHERE board_id = v_opp_board_id AND name = 'Cerrada';

  -- ── 3. TEAMS ──────────────────────────────────────────────────────────────
  INSERT INTO teams (id, workspace_id, name) VALUES
    (v_team_ventas_id,  v_workspace_id, 'Ventas'),
    (v_team_compras_id, v_workspace_id, 'Compras')
  ON CONFLICT (id) DO NOTHING;

  -- ── 4. TERRITORIES ────────────────────────────────────────────────────────
  INSERT INTO territories (id, workspace_id, name) VALUES
    (v_terr_norte_id,  v_workspace_id, 'Norte'),
    (v_terr_centro_id, v_workspace_id, 'Centro'),
    (v_terr_sur_id,    v_workspace_id, 'Sur')
  ON CONFLICT (id) DO NOTHING;

  -- ── 5. BOARD MEMBERS: team Ventas → oportunidades 'edit' ──────────────────
  IF NOT EXISTS (
    SELECT 1 FROM board_members WHERE board_id = v_opp_board_id AND team_id = v_team_ventas_id
  ) THEN
    INSERT INTO board_members (board_id, team_id, access)
    VALUES (v_opp_board_id, v_team_ventas_id, 'edit');
  END IF;

  -- ── 6. CATALOG — 10 productos (owner_id NULL hasta que admin haga login) ──
  FOR i IN 1..10 LOOP
    INSERT INTO items (workspace_id, board_id, name, position)
    VALUES (v_workspace_id, v_catalog_board_id, v_names[i], i);
  END LOOP;

  -- ── 7. ACCOUNTS — 3 cuentas ───────────────────────────────────────────────
  INSERT INTO items (workspace_id, board_id, name, position) VALUES
    (v_workspace_id, v_accounts_board_id, 'SEDENA',           0),
    (v_workspace_id, v_accounts_board_id, 'Guardia Nacional',  1),
    (v_workspace_id, v_accounts_board_id, 'SSP Federal',       2);

  -- ── 8. CONTACTS — 5 contactos ─────────────────────────────────────────────
  INSERT INTO items (workspace_id, board_id, name, position) VALUES
    (v_workspace_id, v_contacts_board_id, 'Juan Martínez',  0),
    (v_workspace_id, v_contacts_board_id, 'Ana Rodríguez',  1),
    (v_workspace_id, v_contacts_board_id, 'Carlos López',   2),
    (v_workspace_id, v_contacts_board_id, 'María González', 3),
    (v_workspace_id, v_contacts_board_id, 'Pedro Sánchez',  4);

  -- ── 9. OPPORTUNITIES — 10 items distribuidos en stages ────────────────────
  INSERT INTO items (workspace_id, board_id, stage_id, name, territory_id, deadline, position) VALUES
    (v_workspace_id, v_opp_board_id, v_stage_nueva_id, v_opp_names[1],  v_terr_centro_id, CURRENT_DATE + 30, 0),
    (v_workspace_id, v_opp_board_id, v_stage_nueva_id, v_opp_names[2],  v_terr_norte_id,  CURRENT_DATE + 45, 1),
    (v_workspace_id, v_opp_board_id, v_stage_cot_id,   v_opp_names[3],  v_terr_centro_id, CURRENT_DATE + 15, 0),
    (v_workspace_id, v_opp_board_id, v_stage_cot_id,   v_opp_names[4],  v_terr_sur_id,    CURRENT_DATE + 20, 1),
    (v_workspace_id, v_opp_board_id, v_stage_cost_id,  v_opp_names[5],  v_terr_norte_id,  CURRENT_DATE + 10, 0),
    (v_workspace_id, v_opp_board_id, v_stage_cost_id,  v_opp_names[6],  v_terr_centro_id, CURRENT_DATE + 25, 1),
    (v_workspace_id, v_opp_board_id, v_stage_pres_id,  v_opp_names[7],  v_terr_sur_id,    CURRENT_DATE +  7, 0),
    (v_workspace_id, v_opp_board_id, v_stage_pres_id,  v_opp_names[8],  v_terr_norte_id,  CURRENT_DATE +  5, 1),
    (v_workspace_id, v_opp_board_id, v_stage_cerr_id,  v_opp_names[9],  v_terr_centro_id, CURRENT_DATE - 10, 0),
    (v_workspace_id, v_opp_board_id, v_stage_cerr_id,  v_opp_names[10], v_terr_sur_id,    CURRENT_DATE -  5, 1);

END $$;
