-- =============================================================================
-- Fix: generate_sid() needs SECURITY DEFINER
-- Without it, the function runs as the calling user (RLS-restricted), which
-- cannot INSERT into sid_registry. Result: "violates row-level security policy
-- for table sid_registry" on any INSERT that auto-assigns a sid.
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_sid()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_sid bigint;
BEGIN
  LOOP
    new_sid := floor(random() * 90000000 + 10000000)::bigint;
    BEGIN
      INSERT INTO sid_registry (sid) VALUES (new_sid);
      RETURN new_sid;
    EXCEPTION WHEN unique_violation THEN
      -- Colisión: reintentar
    END;
  END LOOP;
END;
$$;
