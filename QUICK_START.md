# Quick Start Guide - View the Vantage AI

## Option 1: Quick Demo (Recommended)

To see the application quickly, you have a few options:

### Prerequisites Check
- Do you have PostgreSQL installed and running?
- If not, you can use a local PostgreSQL or a service like Supabase/Railway for free

## Step-by-Step to View the App

### 1. Set up Environment Variables

Create a `.env` file:

```bash
cp .env.example .env
```

Then edit `.env` and set your DATABASE_URL. For a local PostgreSQL:
```
DATABASE_URL="postgresql://username:password@localhost:5432/medical_crm?schema=public"
```

For Supabase (free tier):
- Sign up at https://supabase.com
- Create a new project
- Copy the connection string from Settings → Database
- Use the "Connection string" with password included

### 2. Generate Prisma Client & Run Migrations

```bash
npm run db:generate
npm run db:migrate
```

### 3. Seed the Database (Creates demo data)

```bash
npm run db:seed
```

This creates:
- A demo practice
- Admin user (email: admin@demopractice.com, password: demo123)
- Sample patients
- Sample appointments

### 4. Start the Development Server

```bash
npm run dev
```

### 5. Open in Browser

Navigate to: http://localhost:3000

Login with:
- Email: `admin@demopractice.com`
- Password: `demo123`

## What You'll See

1. **Dashboard** - Overview of today's appointments and recent patients
2. **Patients Page** - List of all patients with search
3. **Patient Details** - Full patient profile with timeline
4. **Appointments** - Calendar view of appointments
5. **Settings** - Cal.com integration configuration

## If You Don't Have PostgreSQL Yet

You can use Docker to run PostgreSQL quickly:

```bash
docker run --name medical-crm-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=medical_crm \
  -p 5432:5432 \
  -d postgres:15
```

Then use:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/medical_crm?schema=public"
```

## Troubleshooting

- **Port 3000 in use?** The dev server will automatically use the next available port
- **Database connection error?** Make sure PostgreSQL is running and DATABASE_URL is correct
- **Prisma errors?** Run `npm run db:generate` again

## File Structure Overview

- `src/app/` - All pages and API routes
- `src/components/` - UI components
- `src/lib/` - Utilities (auth, database, integrations)
- `prisma/schema.prisma` - Database schema
- `prisma/seed.ts` - Demo data seeding script
