-- Supabase security hardening:
-- Ensure Prisma's migration tracking table is not exposed via PostgREST roles.
ALTER TABLE IF EXISTS public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Defense in depth: remove direct table grants from API roles.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE public."_prisma_migrations" FROM anon, authenticated;
  END IF;
END
$$;
