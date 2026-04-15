-- Fase 16.5: Backfill contacto/institucion/monto on existing opportunities boards
-- and institucion on existing contacts boards. Idempotent via WHERE NOT EXISTS.
-- =============================================================================

DO $$
DECLARE
  v_ws record;
  v_opp_id uuid;
  v_contacts_id uuid;
  v_accounts_id uuid;
BEGIN
  FOR v_ws IN SELECT id FROM workspaces LOOP
    SELECT id INTO v_opp_id      FROM boards WHERE workspace_id = v_ws.id AND system_key = 'opportunities' LIMIT 1;
    SELECT id INTO v_contacts_id FROM boards WHERE workspace_id = v_ws.id AND system_key = 'contacts'      LIMIT 1;
    SELECT id INTO v_accounts_id FROM boards WHERE workspace_id = v_ws.id AND system_key = 'accounts'      LIMIT 1;

    -- opportunities.contacto
    IF v_opp_id IS NOT NULL AND v_contacts_id IS NOT NULL THEN
      INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
      SELECT v_opp_id, 'contacto', 'Contacto', 'relation', 4, true,
             jsonb_build_object(
               'target_board_id', v_contacts_id,
               'required', true,
               'auto_fill_targets', jsonb_build_array(
                 jsonb_build_object('source_col_key', 'institucion', 'target_col_key', 'institucion')
               )
             )
      WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE board_id = v_opp_id AND col_key = 'contacto');
    END IF;

    -- opportunities.institucion
    IF v_opp_id IS NOT NULL AND v_accounts_id IS NOT NULL THEN
      INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
      SELECT v_opp_id, 'institucion', 'Institución', 'relation', 5, true,
             jsonb_build_object('target_board_id', v_accounts_id, 'required', true)
      WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE board_id = v_opp_id AND col_key = 'institucion');
    END IF;

    -- opportunities.monto
    IF v_opp_id IS NOT NULL THEN
      INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
      SELECT v_opp_id, 'monto', 'Monto', 'number', 6, true, '{}'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE board_id = v_opp_id AND col_key = 'monto');
    END IF;

    -- contacts.institucion
    IF v_contacts_id IS NOT NULL AND v_accounts_id IS NOT NULL THEN
      INSERT INTO board_columns (board_id, col_key, name, kind, position, is_system, settings)
      SELECT v_contacts_id, 'institucion', 'Institución', 'relation', 5, true,
             jsonb_build_object('target_board_id', v_accounts_id)
      WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE board_id = v_contacts_id AND col_key = 'institucion');
    END IF;
  END LOOP;
END $$;
