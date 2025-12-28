# Database Setup Guide

You need a PostgreSQL database to run the application. Here are the easiest options:

## Option 1: Supabase (Recommended - Free & Easy) ⭐

1. Go to https://supabase.com
2. Sign up for free (or log in)
3. Click "New Project"
4. Fill in:
   - Project name: `medical-crm` (or any name)
   - Database password: Create a strong password (save it!)
   - Region: Choose closest to you
5. Wait ~2 minutes for project setup
6. Go to Settings → Database
7. Copy the "Connection string" (URI format)
8. Replace `DATABASE_URL` in your `.env` file with the connection string
   - It will look like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

**Example:**
```
DATABASE_URL="postgresql://postgres:yourpassword@db.abcdefghijklmnop.supabase.co:5432/postgres"
```

## Option 2: Railway (Free Tier)

1. Go to https://railway.app
2. Sign up/login
3. Click "New Project" → "Provision PostgreSQL"
4. Click on the PostgreSQL service
5. Go to "Variables" tab
6. Copy the `DATABASE_URL`
7. Paste into your `.env` file

## Option 3: Neon (Free Tier)

1. Go to https://neon.tech
2. Sign up/login
3. Create a new project
4. Copy the connection string
5. Paste into your `.env` file

## Option 4: Local PostgreSQL (if installed)

If you have PostgreSQL installed locally:

```bash
# Create database
createdb medical_crm

# Update .env with:
DATABASE_URL="postgresql://your-username:your-password@localhost:5432/medical_crm?schema=public"
```

## Quick Test

After setting up your database, test the connection:

```bash
npm run db:migrate
```

If successful, you'll see migration files being created. Then continue with:

```bash
npm run db:seed
npm run dev
```

