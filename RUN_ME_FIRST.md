# 🚀 Quick Setup Steps

## Step 1: Set Up Database (Choose One Option)

### ⭐ Option A: Supabase (Fastest - ~3 minutes)

1. **Sign up**: Go to https://supabase.com and create a free account
2. **Create project**: Click "New Project"
   - Name: `medical-crm`
   - Password: Choose a strong password (save it!)
   - Region: Choose closest to you
3. **Get connection string**: 
   - Wait for project to finish setting up (~2 minutes)
   - Go to **Settings** → **Database**
   - Find "Connection string" section
   - Copy the **URI** (not the pooler)
   - It looks like: `postgresql://postgres.xxxx:yourpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
   - BUT we need the direct connection: Click "Connection string" → "URI" tab
   - Copy the string (it will have your password in it)

4. **Update `.env` file**:
   - Open `.env` in your editor
   - Replace the `DATABASE_URL` line with your Supabase connection string
   - Example: `DATABASE_URL="postgresql://postgres.xxxx:yourpassword@db.xxxxx.supabase.co:5432/postgres"`

### Option B: Other Free Services
- **Railway**: https://railway.app → New Project → PostgreSQL
- **Neon**: https://neon.tech → Create Project
- **Render**: https://render.com → New PostgreSQL

All work the same way - just copy their connection string to `.env`

## Step 2: After Database is Set Up

Once you have your `DATABASE_URL` in `.env`, come back and we'll run:

```bash
npm run db:migrate    # Creates database tables
npm run db:seed       # Adds demo data
npm run dev          # Starts the app
```

## Current Status ✅

- ✅ `.env` file created
- ✅ NEXTAUTH_SECRET generated
- ⏳ Waiting for DATABASE_URL

**Next**: Set up your database (choose option above) and update the DATABASE_URL in `.env`

