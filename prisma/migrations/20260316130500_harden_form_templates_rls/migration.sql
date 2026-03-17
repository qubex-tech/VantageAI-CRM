-- Supabase security hardening:
-- Ensure this public table cannot be accessed through PostgREST roles by default.
ALTER TABLE IF EXISTS public."form_templates" ENABLE ROW LEVEL SECURITY;

-- Defense in depth: remove direct table grants from API roles.
DO $$
BEGIN
  IF to_regclass('public.form_templates') IS NOT NULL THEN
    REVOKE ALL ON TABLE public."form_templates" FROM anon, authenticated;
  END IF;
END
$$;
