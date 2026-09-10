# AGENTS.md

## Cursor Cloud specific instructions

This repo is a multi-tenant medical-practice CRM ("Vantage AI"). The primary product is the
Next.js web app at the repo root (CRM + patient portal + API). See `README.md`, `QUICK_START.md`,
and `SETUP_DATABASE.md` for the canonical, human-facing setup/run commands; this section only
records the non-obvious things needed to run it in the Cursor Cloud VM.

### Services (primary product)

| Service | Purpose | How to run | Port |
|---------|---------|------------|------|
| Next.js web app | CRM UI + API + patient portal | `npm run dev` (from repo root) | 3000 |
| PostgreSQL 16 | App database (Prisma) | `sudo pg_ctlcluster 16 main start` | 5432 |
| Local Supabase stack | CRM auth backend (GoTrue). REQUIRED to log in. | `supabase start` in `/home/ubuntu/supabase-local` (needs Docker) | 54321 (API), 54323 (Studio) |

Optional / not needed for the core CRM happy path: Inngest dev server (`npx inngest-cli@latest dev`),
the Expo mobile app in `mobile/`, and the standalone MCP server in `mcp-server/`.

### Auth is Supabase-only — this is the big gotcha

The CRM login page (`/login`) and all server pages authenticate through **Supabase Auth**, not
NextAuth. `src/lib/auth.ts` (NextAuth credentials) still exists but is **not** wired into the web UI,
so the seeded `passwordHash` alone will not log you in. `src/middleware.ts` only enforces the
Supabase gate for `getvantage.tech` hosts, but every protected page also calls
`requireAuthenticatedUser()` (`src/lib/auth-server.ts` → `getSupabaseSession()`), so a reachable
Supabase Auth server is mandatory even on `localhost`.

The `NEXT_PUBLIC_SUPABASE_URL` value shipped in `.env.local.example` / `.env.backup.*` points at a
remote Supabase project that no longer resolves (DNS NXDOMAIN). Do **not** use it. Use the local
Supabase stack instead.

On first login the Supabase user is synced into Prisma by email (`src/lib/sync-supabase-user.ts`):
if a Prisma user with that email already exists (e.g. the seeded `admin@demopractice.com`), it is
reused with its existing `practiceId`; otherwise a brand-new practice is created for that email.

### `.env` (git-ignored — must exist on disk; recreate if missing)

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/medical_crm?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<any 32+ char secret, e.g. openssl rand -base64 32>"
NODE_ENV="development"
# Local Supabase CLI stack (standard demo keys — same on every machine)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

`NEXT_PUBLIC_*` values are inlined at dev-server start — **restart `npm run dev` after editing them.**

### Cold-start runbook (services are not auto-started on a fresh VM)

The update script only runs `npm install`. Start the stateful services yourself:

```
sudo pg_ctlcluster 16 main start                       # PostgreSQL
sudo bash -c 'nohup dockerd > /var/log/dockerd.log 2>&1 &'   # only if `docker info` fails
sudo chmod 666 /var/run/docker.sock                    # docker without sudo
cd /home/ubuntu/supabase-local && supabase start       # local Supabase (idempotent)
```

If the database is empty (fresh volume), sync the schema and seed demo data from the repo root:

```
npx prisma db push     # use db push, NOT `prisma migrate deploy` — see below
npm run db:seed        # partial failure is expected — see below
```

Ensure the demo auth user exists in Supabase (idempotent; ignore "already registered"):

```
curl -sS -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demopractice.com","password":"demo123","email_confirm":true,"user_metadata":{"name":"Admin User"}}'
```

Then `npm run dev` and log in at http://localhost:3000/login with
`admin@demopractice.com` / `demo123` (Password tab).

### Migrations: use `db push`, not `migrate deploy`

The `prisma/migrations` folder has out-of-order timestamps (`20250101…add_workflows` sorts before
`20251228…init`), so `prisma migrate deploy` / `migrate dev` fails with `relation "practices" does
not exist`. For local dev, sync the schema directly with `npx prisma db push` (this matches the
repo's own `MIGRATION_FIXED.md` guidance).

### Known pre-existing breakages (not env problems — do not "fix" during setup)

- `npm run db:seed` fails partway at `insurancePolicy.createMany` (`Argument payerNameRaw is
  missing` — the seed predates a required schema column). The practice, `admin@demopractice.com`
  user, and 10 demo patients are created before that point, which is enough for the happy path.
- `npm test` (root Vitest) reports one failed suite:
  `packages/opendental-sdk/tests/unit/services/patients.test.ts` cannot resolve the `@sdk` path
  alias when swept up by the root runner. The rest pass (~811 tests). Run the SDK's own tests with
  `npm run test:opendental` (they pass there).

### Lint / test / build / run (primary app, from repo root)

- Lint: `npm run lint` (passes with warnings only)
- Test: `npm test` (see SDK caveat above); SDK: `npm run test:opendental`
- Run (dev): `npm run dev`
- Build: `npm run build` (`prisma generate && next build`)
