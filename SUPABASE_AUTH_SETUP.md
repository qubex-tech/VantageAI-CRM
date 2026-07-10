# Supabase Auth Setup Guide

## Steps to Complete

### 1. Get Supabase API Keys

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/yxmtekolhhyeypicyfzq
2. Navigate to **Settings** → **API**
3. Find **Project API keys** section
4. Copy the **anon public** key (this is safe to expose in client-side code)

### 2. Update .env File

Add these variables to your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://yxmtekolhhyeypicyfzq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace `your-anon-key-here` with the anon public key from step 1.

### 3. Configure Supabase Auth Settings

In your Supabase Dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Add these to **Site URL**:
   - `http://localhost:3000` (for development)
   - Add your production URL when deploying

3. Add these to **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`
   - `https://app.getvantage.tech/auth/callback`
   - `https://app.getvantage.tech/reset-password`
   - Add other production/preview URLs when deploying

   Password reset emails redirect to `/reset-password`, where the browser exchanges the PKCE `code` (the code verifier cookie is set when the user requests the reset). Magic links still use `/auth/callback`.

4. Go to **Authentication** → **Email Templates**
   - Customize email templates if desired (optional)
   - The default templates work fine

### 4. Enable Email Auth

1. Go to **Authentication** → **Providers**
2. Make sure **Email** provider is enabled
3. Configure email settings:
   - **Enable email confirmations**: Optional (recommended for production)
   - **Secure email change**: Optional

### 5. Test the Flow

1. **Sign Up**:
   - Go to `/signup`
   - Create a new account
   - Check email for verification (if enabled)

2. **Login**:
   - Go to `/login`
   - Sign in with your credentials

3. **Forgot Password**:
   - Go to `/forgot-password`
   - Enter your email
   - Check email for reset link
   - Click link to reset password

## Features Implemented

✅ **Sign Up** (`/signup`)
- Create new account with email/password
- Email verification support
- Password strength requirements

✅ **Login** (`/login`)
- Sign in with email/password
- Links to sign up and forgot password

✅ **Forgot Password** (`/forgot-password`)
- Request password reset email
- Secure reset link via email

✅ **Reset Password** (`/reset-password`)
- Set new password from email link
- Password confirmation

## Data access architecture (Supabase #45329)

This project uses Supabase for **Auth** and as the **Postgres host** only. Application data is read and written through **Prisma** and `DATABASE_URL` (direct/pooled Postgres), not through the Supabase Data API (PostgREST / `supabase.from()`).

| Concern | How this repo handles it |
|--------|---------------------------|
| Auth | `@supabase/ssr` / `supabase.auth.*` |
| CRM data | Prisma in API routes and server components |
| Mobile login | `POST /auth/v1/token` via [`src/app/api/mobile/auth/route.ts`](src/app/api/mobile/auth/route.ts) |

**Do not** add `supabase.from()` or `/rest/v1/` calls for app data without explicit Postgres `GRANT`s and RLS policies. Blanket grants on every Prisma migration would widen PostgREST exposure without benefit.

Supabase is changing defaults so new `public` tables are not auto-exposed to the Data API ([discussion #45329](https://github.com/orgs/supabase/discussions/45329)). That rollout does **not** affect Prisma. Enforcement on existing projects: **October 30, 2026**.

- Dashboard review: [`docs/supabase-45329-dashboard-checklist.md`](docs/supabase-45329-dashboard-checklist.md)
- Optional project hardening SQL: [`scripts/sql/supabase-45329-revoke-default-privileges.sql`](scripts/sql/supabase-45329-revoke-default-privileges.sql)
- Existing defense-in-depth: `REVOKE` migrations on `_prisma_migrations` and `form_templates`

## Integration Notes

- Supabase Auth handles all password hashing and session management
- No need to store passwords in your database
- Sessions are managed by Supabase
- Email sending is handled by Supabase
- Prisma `User` records are synced from Supabase via [`src/lib/sync-supabase-user.ts`](src/lib/sync-supabase-user.ts)

## Next Steps (Optional)

After setting up auth, you may want to:
1. Sync Supabase Auth users with your Prisma User model
2. Create users in your database when they sign up
3. Link Supabase user ID with practice membership

For now, the auth flow works independently. You can integrate it with your existing user model later.

