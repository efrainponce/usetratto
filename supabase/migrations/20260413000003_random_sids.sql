-- =============================================================================
-- 009_random_sids.sql
-- Reemplaza tratto_sid_seq (secuencial) con generate_sid() (random 8 dígitos)
-- Razón: IDs secuenciales son enumerables y predecibles — inseguro para una app
--        que expone SIDs en URLs y en UI.
-- Formato: 10000000–99999999 (8 dígitos) — consistente con IDs existentes
-- Unicidad global: tabla sid_registry garantiza que nunca hay colisión entre entidades
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla de registro global de SIDs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sid_registry (
  sid bigint PRIMARY KEY
);

-- ---------------------------------------------------------------------------
-- 2. Registrar todos los SIDs existentes en la BD
-- ---------------------------------------------------------------------------
INSERT INTO sid_registry (sid)
SELECT sid FROM workspaces
UNION
SELECT sid FROM users
UNION
SELECT sid FROM teams
UNION
SELECT sid FROM territories
UNION
SELECT sid FROM boards
UNION
SELECT sid FROM board_stages
UNION
SELECT sid FROM board_columns
UNION
SELECT sid FROM items
UNION
SELECT sid FROM sub_items
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Función generate_sid() — random 8 dígitos con retry en colisión
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_sid()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  new_sid bigint;
BEGIN
  LOOP
    -- Rango: 10,000,000 – 99,999,999 (90M posibles valores)
    new_sid := floor(random() * 90000000 + 10000000)::bigint;
    BEGIN
      INSERT INTO sid_registry (sid) VALUES (new_sid);
      RETURN new_sid;
    EXCEPTION WHEN unique_violation THEN
      -- Colisión: reintentar con otro número
    END;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cambiar DEFAULT de todas las columnas sid
-- ---------------------------------------------------------------------------
ALTER TABLE workspaces    ALTER COLUMN sid SET DEFAULT generate_sid();
ALTER TABLE users         ALTER COLUMN sid SET DEFAULT generate_sid();
ALTER TABLE teams         ALTER COLUMN sid SET DEFAULT generate_sid();
ALTER TABLE territories   ALTER COLUMN sid SET DEFAULT generate_sid();
ALTER TABLE boards        ALTER COLUMN sid SET DEFAULT generate_sid();
ALTER TABLE board_stages  ALTER COLUMN sid SET DEFAULT generate_sid();
ALTER TABLE board_columns ALTER COLUMN sid SET DEFAULT generate_sid();
ALTER TABLE items         ALTER COLUMN sid SET DEFAULT generate_sid();
ALTER TABLE sub_items     ALTER COLUMN sid SET DEFAULT generate_sid();

-- ---------------------------------------------------------------------------
-- 5. Eliminar el sequence secuencial
-- ---------------------------------------------------------------------------
DROP SEQUENCE IF EXISTS tratto_sid_seq;
