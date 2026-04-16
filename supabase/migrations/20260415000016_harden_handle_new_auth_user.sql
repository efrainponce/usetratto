-- Fase 17 — Harden handle_new_auth_user for email signups (inviteUserByEmail)
--
-- The original trigger reliably works for phone OTP but fails for email invites
-- with "Database error saving new user" from GoTrue. Root causes guarded against:
--   1. Unqualified `users` reference — disambiguate with `public.users`
--   2. Implicit search_path — SET explicitly on the function
--   3. Any unexpected error in the AFTER-INSERT trigger rolls back the entire
--      auth.users insert. Wrap in EXCEPTION block so a failure does NOT block
--      GoTrue. If the public.users row can't be created here, the fallback in
--      `requireAuthApi()` provisions it lazily on first authenticated request.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_phone  text;
  v_sa_row superadmin_phones%ROWTYPE;
BEGIN
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');

  SELECT * INTO v_sa_row
  FROM public.superadmin_phones
  WHERE phone = v_phone;

  BEGIN
    INSERT INTO public.users (id, name, phone, email, role, workspace_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      v_phone,
      NEW.email,
      CASE WHEN v_sa_row.phone IS NOT NULL THEN 'superadmin' ELSE 'member' END,
      v_sa_row.workspace_id
    )
    ON CONFLICT (id) DO UPDATE SET
      phone        = COALESCE(EXCLUDED.phone, public.users.phone),
      email        = COALESCE(EXCLUDED.email, public.users.email),
      role         = CASE
                       WHEN v_sa_row.phone IS NOT NULL THEN 'superadmin'
                       ELSE public.users.role
                     END,
      workspace_id = COALESCE(v_sa_row.workspace_id, public.users.workspace_id);
  EXCEPTION WHEN OTHERS THEN
    -- Swallow the error so GoTrue's auth.users insert still commits.
    -- requireAuthApi() will provision the public.users row on first request.
    RAISE WARNING 'handle_new_auth_user failed for id=% email=% phone=%: % (%)',
      NEW.id, NEW.email, v_phone, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;
