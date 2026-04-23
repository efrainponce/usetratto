-- Renombra "Institución" → "Cuenta" para workspaces existentes.
-- Opera sobre system_key='accounts' (ya genérico) y renombra:
--   • board: slug 'instituciones' → 'cuentas', name 'Instituciones' → 'Cuentas'
--   • col   'institucion' en Contactos → 'cuenta' ('Institución' → 'Cuenta')
--   • col   'institucion' en Cotizaciones → se elimina (la cuenta viene del contacto)
-- Idempotente: skip si ya está renombrado.

DO $$
DECLARE
  r RECORD;
  v_inst_col_id uuid;
BEGIN
  -- 1) Renombrar el board de cuentas (solo por system_key; el slug/name pudo cambiar)
  UPDATE boards
  SET slug = 'cuentas', name = 'Cuentas'
  WHERE system_key = 'accounts'
    AND (slug <> 'cuentas' OR name <> 'Cuentas');

  -- 2) Renombrar col `institucion` → `cuenta` en el board de Contactos de cada workspace
  FOR r IN
    SELECT id AS board_id
    FROM boards
    WHERE system_key = 'contacts'
  LOOP
    IF EXISTS (SELECT 1 FROM board_columns WHERE board_id = r.board_id AND col_key = 'institucion') THEN
      UPDATE board_columns
      SET col_key = 'cuenta', name = 'Cuenta'
      WHERE board_id = r.board_id AND col_key = 'institucion';
    END IF;
  END LOOP;

  -- 3) Eliminar col `institucion` del board de Cotizaciones (se resuelve vía contacto)
  FOR r IN
    SELECT id AS board_id
    FROM boards
    WHERE system_key = 'quotes'
  LOOP
    SELECT id INTO v_inst_col_id
    FROM board_columns
    WHERE board_id = r.board_id AND col_key = 'institucion';

    IF v_inst_col_id IS NOT NULL THEN
      -- Limpia sub_item_views que referencían esta col
      DELETE FROM sub_item_views
      WHERE (config->>'relation_col_id')::uuid = v_inst_col_id;

      -- Limpia item_values asociados
      DELETE FROM item_values WHERE column_id = v_inst_col_id;

      -- Borra la columna
      DELETE FROM board_columns WHERE id = v_inst_col_id;
    END IF;
  END LOOP;
END $$;
