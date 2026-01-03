# Cursor Handoff Document - Vantage AI CRM

## Goal / What We're Building

A multi-tenant medical CRM for practices with workflow automation capabilities. The system allows practices to manage patients, appointments, and automate workflows triggered by events (appointment created, patient updated, etc.). Currently supports Cal.com scheduling, RetellAI voice agents, and SendGrid email integration.

## Current Architecture

**Frontend:**
- Next.js 14 App Router with React Server Components (RSC)
- Tailwind CSS + shadcn/ui components
- Mobile-first responsive design

**Backend:**
- Next.js API Route Handlers (serverless functions)
- Prisma ORM for database access
- PostgreSQL database (Supabase in production)
- Supabase Authentication (replacing NextAuth.js - migration in progress)

**Database:**
- PostgreSQL with Prisma schema
- Row-level multi-tenancy via `practiceId` on all tenant tables
- Connection pooling: Transaction Mode (port 6543) recommended for Vercel

**Integrations:**
- Cal.com API (appointment scheduling)
- RetellAI (voice agent webhooks)
- SendGrid (email sending)

**Infrastructure:**
- Deployed on Vercel
- Database: Supabase PostgreSQL
- Environment: Serverless (Vercel Functions)

## Chosen Workflow Architecture Decisions (Not Yet Implemented)

**Decision:** Build a robust workflow automation system with the following architecture:

1. **Outbox Pattern**: For reliable event publishing and workflow triggering
2. **Temporal Orchestration**: For long-running workflow execution and retries
3. **JSONLogic/CEL**: For condition evaluation in workflow steps
4. **Plugin Action Runner**: Extensible action system for workflow steps (send email, update patient, etc.)
5. **OpenTelemetry**: For observability and tracing of workflow execution
6. **Audit Ledger**: Immutable audit log for all workflow executions and state changes

**Note:** These decisions have been made but are NOT yet implemented. The current workflow system only has:
- Database schema (`Workflow`, `WorkflowStep`, `WorkflowRun` models)
- UI for creating/editing workflows (trigger + conditions + actions)
- Basic workflow CRUD API endpoints
- NO execution engine yet

## What's Already Implemented

### Core CRM Features ✅
- Multi-tenant architecture with row-level isolation via `practiceId`
- Patient management (CRUD, search, filtering, tags, timeline)
- Appointment scheduling (local + Cal.com integration)
- Insurance policy management
- Patient activity timeline (emails, notes, appointments, field updates, calls)
- Voice conversation logging (RetellAI integration)

### Authentication & Authorization ✅
- Supabase Authentication (session-based)
- Role-based access control (`vantage_admin`, `practice_admin`, `regular_user`)
- User sync between Supabase Auth and Prisma
- Protected routes with middleware
- Vantage Admin support (users with `practiceId = null` can manage all practices)

### Integrations ✅
- Cal.com API client and webhook handler
- RetellAI webhook handler and agent actions
- SendGrid email integration (API key stored per practice)
- Email composition UI in patient details view

### Workflow UI (No Execution Engine) ✅
- Workflow list/overview page with stats (runs, status, creator, last published)
- Workflow editor UI (trigger selection, condition blocks, action blocks)
- Workflow CRUD API endpoints
- Database schema for workflows, steps, and runs
- Workflow publishing/unpublishing (sets `publishedAt` timestamp)

### Settings & Configuration ✅
- Cal.com integration settings (API key, event type mappings)
- RetellAI integration settings (API key)
- SendGrid integration settings (API key, from email/name)
- Practice management UI (Vantage Admin can create practices with users)

### UI Components ✅
- Mobile-first responsive design
- Patient table view with filtering (basic + advanced)
- Saved filter tabs
- Patient detail page (Overview, Activity, Appointments, Calls tabs)
- Email composer modal
- Workflow builder UI with dotted grid background

### Infrastructure ✅
- Vercel Speed Insights integration
- Vercel Web Analytics integration
- PHI redaction utilities
- Audit logging system
- Patient activity logging system (`src/lib/patient-activity.ts`)

## What's Broken / Blocked Right Now

### Prisma Client Sync Issues ⚠️
- **Issue**: Prisma Client on Vercel is out of sync with database schema
- **Symptom**: "Column `workflows.publishedAt` does not exist" errors (even though column exists in DB)
- **Root Cause**: Prisma Client not regenerating on Vercel builds, or build cache issues
- **Workaround**: Raw SQL queries in workflow API endpoints to bypass Prisma Client validation
- **Files Affected**: 
  - `src/app/api/workflows/route.ts`
  - `src/app/api/workflows/[id]/route.ts`
  - `src/app/(main)/automations/workflows/page.tsx`
  - `src/app/(main)/automations/workflows/[id]/page.tsx`
- **Long-term Fix Attempted**: Added `postinstall: "prisma generate"` script, but issue persists
- **Status**: Functional with workarounds, but needs proper fix

### Schema Drift ⚠️
- Database has `published_at` (snake_case) column
- Prisma schema uses `publishedAt` (camelCase) with `@map("published_at")`
- Prisma Client generation not reflecting the mapping correctly on Vercel
- **Note**: Works locally, fails on Vercel production

### Practice Management UI (In Progress) 🚧
- UI exists (`src/components/settings/PracticeManagement.tsx`)
- Can create practices with practice admins and regular users
- **Status**: Recently implemented, may need testing/polish

## Next 3 Tasks (Very Specific)

1. **Implement Workflow Execution Engine**
   - Create workflow trigger system (listen for events: appointment created, patient updated, etc.)
   - Build workflow runner that:
     - Loads active workflows (`isActive = true`)
     - Evaluates triggers
     - Executes condition blocks (JSONLogic/CEL evaluation)
     - Executes action blocks (plugin system: send email, update patient, etc.)
     - Records workflow runs in `WorkflowRun` table
   - Files to create: `src/lib/workflows/runner.ts`, `src/lib/workflows/triggers.ts`, `src/lib/workflows/actions.ts`
   - Integration point: Hook into existing event sources (patient updates, appointment creation, etc.)

2. **Fix Prisma Client Sync on Vercel**
   - Investigate why `postinstall` script isn't regenerating Prisma Client on Vercel
   - Consider: Clear build cache, verify Prisma version consistency, check `vercel.json` configuration
   - Remove raw SQL workarounds once Prisma Client sync is fixed
   - Files to update: All workflow-related files with raw SQL fallbacks

3. **Implement Outbox Pattern for Workflow Events**
   - Create `outbox` table in Prisma schema for reliable event publishing
   - Add outbox publisher that writes events to outbox table in same transaction
   - Create outbox processor (separate worker/API route) that:
     - Polls outbox table for unpublished events
     - Publishes events (triggers workflows)
     - Marks events as published
   - Files to create: `prisma/migrations/XXXXX_add_outbox/migration.sql`, `src/lib/outbox/publisher.ts`, `src/lib/outbox/processor.ts`
   - Integration: Replace direct workflow triggers with outbox publishing

## Key Files / Folders

### Core Application
```
src/
├── app/
│   ├── (auth)/              # Authentication pages (login, signup, reset password)
│   ├── (main)/              # Protected application pages
│   │   ├── dashboard/
│   │   ├── patients/        # Patient list, detail, new patient
│   │   ├── appointments/    # Appointment list, detail, new appointment
│   │   ├── calls/           # Voice calls list and detail
│   │   ├── automations/
│   │   │   └── workflows/   # Workflow list, editor, new workflow
│   │   └── settings/        # Integration settings, practice management
│   └── api/                 # API Route Handlers
│       ├── patients/
│       ├── appointments/
│       ├── workflows/
│       ├── emails/
│       ├── cal/webhook/
│       ├── retell/webhook/
│       └── settings/
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── patients/            # Patient-related components
│   ├── workflows/           # Workflow builder components
│   ├── settings/            # Settings components
│   └── layout/              # Navigation, sidebar, bottom nav
└── lib/
    ├── db.ts                # Prisma client singleton
    ├── middleware.ts        # Auth middleware, requireAuth()
    ├── auth-supabase.ts     # Supabase session helpers
    ├── sync-supabase-user.ts # User sync between Supabase and Prisma
    ├── permissions.ts       # RBAC permission checks
    ├── cal.ts               # Cal.com API client
    ├── retell-api.ts        # RetellAI API client
    ├── sendgrid.ts          # SendGrid API client
    ├── patient-activity.ts  # Patient activity logging system
    ├── agentActions.ts      # RetellAI agent actions (find patient, book appointment)
    ├── process-call-data.ts # Process RetellAI calls for patient extraction
    ├── sync-booking-to-patient.ts # Sync Cal.com bookings to patient records
    ├── audit.ts             # Audit logging
    ├── phi.ts               # PHI redaction utilities
    └── validations.ts       # Zod schemas
```

### Database
```
prisma/
├── schema.prisma            # Prisma schema (all models)
└── migrations/              # Database migrations
    ├── 20251228054209_init/
    ├── 20251229050412_add_retell_integration/
    ├── 20250101000000_add_workflows/
    ├── 20250103000000_add_sendgrid_integration/
    └── 20250104000000_add_published_at_to_workflow/
```

### Key Models (Prisma Schema)
- `Practice` - Tenant entity
- `User` - Users (vantage_admin, practice_admin, regular_user roles)
- `Patient` - Patient records
- `Appointment` - Appointments (local + Cal.com sync)
- `Workflow` - Workflow definitions
- `WorkflowStep` - Workflow steps (conditions, actions)
- `WorkflowRun` - Workflow execution history
- `AuditLog` - Audit trail
- `PatientTimelineEntry` - Patient activity timeline
- `CalIntegration`, `RetellIntegration`, `SendgridIntegration` - Integration configs

## Env + Secrets Status

### Required Environment Variables

**Database:**
- `DATABASE_URL` - PostgreSQL connection string (Supabase in production)
  - **Format**: `postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
  - **Mode**: Transaction Mode (port 6543) recommended for Vercel
  - **Status**: ✅ Configured in Vercel

**Authentication:**
- `NEXTAUTH_SECRET` - Session encryption secret
  - **Status**: ✅ Configured (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Application URL
  - **Status**: ✅ Configured (https://app.getvantage.tech in production)

**Supabase (if using Supabase Auth):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - **Status**: ⚠️ Check if configured
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
  - **Status**: ⚠️ Check if configured
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
  - **Status**: ⚠️ Check if configured

**Integration Keys (Stored per-practice in database, not env vars):**
- Cal.com API key - Stored in `cal_integrations` table
- RetellAI API key - Stored in `retell_integrations` table
- SendGrid API key - Stored in `sendgrid_integrations` table

**Webhook Secrets:**
- `CALCOM_WEBHOOK_SECRET` - Cal.com webhook signature verification
  - **Status**: ⚠️ Check if configured (currently using "vantageai" as placeholder)
- `RETELLAI_WEBHOOK_SECRET` - RetellAI webhook signature verification
  - **Status**: ⚠️ Check if configured

**Vercel (Auto-configured):**
- `NODE_ENV` - Set to "production" on Vercel
- `VERCEL_ENV` - Vercel environment (production, preview, development)

### Environment Variable Locations

- **Local Development**: `.env` file (not in git, see `.env.example` for template)
- **Vercel Production**: Vercel Dashboard → Project → Settings → Environment Variables
- **Vercel Preview**: Same as above, can override per environment

### Not Configured / Missing

- Temporal connection details (when implementing Temporal orchestration)
- OpenTelemetry exporter configuration (when implementing observability)
- Outbox processor worker configuration (when implementing outbox pattern)

## Commands to Run

### Development
```bash
# Install dependencies
npm install

# Generate Prisma Client
npm run db:generate
# OR (runs automatically via postinstall)
npm install

# Run database migrations
npm run db:migrate
# OR for production
npx prisma migrate deploy

# Seed database with demo data
npm run db:seed

# Start development server
npm run dev
# Opens http://localhost:3000
```

### Database Management
```bash
# Open Prisma Studio (database GUI)
npm run db:studio

# Create new migration (after schema changes)
npm run db:migrate

# Reset database (development only - DESTRUCTIVE)
npx prisma migrate reset

# Verify migrations are in sync
npm run db:verify
```

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Build & Deploy
```bash
# Build for production
npm run build

# Start production server (local testing)
npm start

# Deploy to Vercel (if using Vercel CLI)
vercel
vercel --prod
```

### Debug Scripts
```bash
# Simulate RetellAI webhook
npm run simulate:retell
```

## Constraints

### Multi-Tenancy
- **All data must be scoped to `practiceId`**
- All database queries must include `practiceId` filter
- API routes use `requireAuth()` which extracts `practiceId` from session
- Vantage Admins have `practiceId = null` and can access all practices
- Practice Admins and Regular Users are scoped to their practice
- Recent change: Added null checks for `practiceId` throughout the codebase to support Vantage Admins

### HIPAA Considerations (Not Fully Compliant Yet)
- PHI redaction utilities exist (`src/lib/phi.ts`) but not comprehensively applied
- Audit logging exists but needs enhancement
- Data encryption at rest: Not implemented (rely on Supabase/PostgreSQL encryption)
- Data encryption in transit: HTTPS enforced (Vercel default)
- Access controls: RBAC implemented but may need refinement
- Data retention policies: Not implemented
- Backup/disaster recovery: Rely on Supabase backups
- BAA with vendors: Not verified (Supabase, Vercel, Cal.com, RetellAI, SendGrid)

### Auditability
- All CRUD operations logged to `AuditLog` table
- Patient activity logged to `PatientTimelineEntry` table
- Workflow runs logged to `WorkflowRun` table
- Audit logs include: user, action, resource type, resource ID, changes (redacted), IP, user agent, timestamp

### Performance
- Serverless functions (Vercel) have cold start latency
- Database connection pooling: Transaction Mode (port 6543) for better concurrency
- Connection limit: 1 connection per serverless function (Transaction Mode)
- Background processing: Used for non-blocking operations (call processing)

### Deployment
- **Platform**: Vercel (serverless Next.js)
- **Database**: Supabase PostgreSQL
- **Build Cache**: Can cause Prisma Client sync issues - may need to clear cache
- **Auto-deploy**: Enabled on git push to main branch
- **Environment**: Production URL: https://app.getvantage.tech

## Additional Notes

### Authentication Migration Status
- Previously used NextAuth.js with credentials provider
- Migrating to Supabase Authentication
- `src/lib/auth-supabase.ts` contains Supabase session helpers
- `src/lib/sync-supabase-user.ts` syncs Supabase users to Prisma User table
- Session middleware uses Supabase (`src/middleware.ts`)

### Workflow System Status
- **Database schema**: ✅ Complete
- **UI (builder)**: ✅ Complete
- **API (CRUD)**: ✅ Complete (with Prisma Client sync workarounds)
- **Execution engine**: ❌ Not implemented
- **Trigger system**: ❌ Not implemented
- **Action plugins**: ❌ Not implemented

### Known Issues
1. Prisma Client sync on Vercel (see "What's Broken" section)
2. Workflow execution not yet implemented (workflows can be created but don't run)
3. Some webhook secrets may use placeholder values

### Useful Debug Endpoints
- `/api/debug/session` - Check session status
- `/api/debug/auth-status` - Check authentication status
- `/api/debug/db-config` - Check database connection configuration
- `/api/debug/env` - Check environment variables (be careful with secrets)

### Recent Changes
- Added support for Vantage Admin users (`practiceId = null`)
- Added practice management UI for Vantage Admins
- Added null checks for `practiceId` throughout API routes and pages
- Updated permission system to support Vantage Admin role

---

**Last Updated**: 2025-01-04
**Codebase**: Medical CRM / Vantage AI
**Deployment**: Vercel (https://app.getvantage.tech)

