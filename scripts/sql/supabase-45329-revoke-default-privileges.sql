-- Supabase #45329: opt into "new tables not auto-exposed to Data API" on existing projects.
-- Safe for Medical CRM: all app data access uses Prisma over DATABASE_URL, not PostgREST.
--
-- Run once in Supabase Dashboard → SQL Editor (production project).
-- Rollback instructions: https://github.com/orgs/supabase/discussions/45329
--
-- Existing tables keep their current grants until you revoke per table.
-- Only future tables created by role `postgres` in schema `public` are affected.

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
