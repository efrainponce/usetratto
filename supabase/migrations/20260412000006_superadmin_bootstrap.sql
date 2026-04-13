-- =============================================================================
-- 006_superadmin_bootstrap.sql
-- Auto-provisioning de superadmin en primer login OTP
-- El trigger asigna workspace_id + role = 'superadmin' si el phone coincide
-- =============================================================================

-- Tabla de phones pre-autorizados como superadmin
CREATE TABLE IF NOT EXISTS superadmin_phones (
  phone        text PRIMARY KEY,  -- E.164 format, ej: +521234567890
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Insertar el superadmin del workspace CMP
-- AJUSTA el phone si el formato es distinto
INSERT INTO superadmin_phones (phone, workspace_id)
VALUES ('+521234567890', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (phone) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Actualizar handle_new_auth_user para auto-asignar superadmin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_phone       text;
  v_sa_row      superadmin_phones%ROWTYPE;
BEGIN
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');

  -- Buscar si este phone está pre-autorizado como superadmin
  SELECT * INTO v_sa_row FROM superadmin_phones WHERE phone = v_phone;

  INSERT INTO users (id, name, phone, email, role, workspace_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    v_phone,
    NEW.email,
    CASE WHEN v_sa_row.phone IS NOT NULL THEN 'superadmin' ELSE 'member' END,
    v_sa_row.workspace_id  -- NULL si no es superadmin
  )
  ON CONFLICT (id) DO UPDATE SET
    phone        = EXCLUDED.phone,
    role         = CASE WHEN v_sa_row.phone IS NOT NULL THEN 'superadmin' ELSE users.role END,
    workspace_id = COALESCE(v_sa_row.workspace_id, users.workspace_id);

  RETURN NEW;
END;
$$;
