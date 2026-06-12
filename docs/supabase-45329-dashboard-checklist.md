# Supabase #45329 — Dashboard checklist

Manual steps for project owners. The app uses **Prisma + `DATABASE_URL`** for data and **Supabase Auth** only; this checklist ensures the Supabase project settings match that architecture before the **October 30, 2026** platform rollout.

References:

- [GitHub discussion #45329](https://github.com/orgs/supabase/discussions/45329)
- [Changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

## 1. Security Advisor

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Advisors** (or **Database** → **Security Advisor**, depending on UI version).
3. Review any findings related to:
   - Tables exposed via the Data API without RLS
   - Missing grants on new tables (after you opt into stricter defaults)
4. Remediate or document accepted risk for each finding.

Record results here (update after each review):

| Date | Reviewer | Open findings | Notes |
|------|----------|---------------|-------|
| | | | |

## 2. “Automatically expose new tables and functions”

1. **Database** → **Settings** (or **API** settings).
2. Find **Automatically expose new tables and functions**.
3. Record current value:

| Date | Setting (on/off) | Notes |
|------|------------------|-------|
| | | |

**Recommendation for this repo:** Prefer **off** (or run [`scripts/sql/supabase-45329-revoke-default-privileges.sql`](../scripts/sql/supabase-45329-revoke-default-privileges.sql)) so new `public` tables are not reachable via PostgREST unless you add explicit `GRANT`s. Prisma migrations do not need this setting to be on.

## 3. Confirm no Data API dependencies

Confirm none of the following rely on implicit `anon` / `authenticated` grants on `public` tables:

- [ ] Retool, Metabase, or other BI tools hitting `/rest/v1/`
- [ ] Browser code using `supabase.from()` (this codebase does not — see repo grep)
- [ ] One-off scripts using the anon key against PostgREST

If any exist, add explicit `GRANT` + RLS per table or move them to Prisma/server-side APIs.

## 4. Post-hardening smoke test

After changing default privileges (optional SQL script):

1. `npx prisma migrate deploy` — succeeds.
2. Web login + `/auth/callback` — session works.
3. `POST /api/mobile/auth` — valid credentials return JWT.
4. A Prisma-backed route (e.g. patients list) — reads/writes OK.
