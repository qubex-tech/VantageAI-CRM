# Supabase Auth Setup - Quick Instructions

## ✅ What's Been Added

1. **Sign Up Page** (`/signup`) - Create new accounts
2. **Login Page** (`/login`) - Updated to use Supabase Auth
3. **Forgot Password Page** (`/forgot-password`) - Request password reset
4. **Reset Password Page** (`/reset-password`) - Set new password

## 🔧 Setup Steps

### 1. Get Your Supabase API Key

1. Go to: https://supabase.com/dashboard/project/yxmtekolhhyeypicyfzq
2. Click **Settings** → **API**
3. Under **Project API keys**, copy the **anon public** key

### 2. Add to .env File

Add these two lines to your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://yxmtekolhhyeypicyfzq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace `your-anon-key-here` with the key you copied.

### 3. Configure Supabase Auth Settings

In Supabase Dashboard:

1. **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: Add `http://localhost:3000/auth/callback`, `http://localhost:3000/reset-password`, and the same paths for production (`https://app.getvantage.tech/...`)

2. **Authentication** → **Providers**:
   - Make sure **Email** provider is enabled

### 4. Restart Dev Server

After adding the environment variables:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## 🧪 Test It Out

1. **Sign Up**: Go to `/signup` and create a new account
2. **Login**: Go to `/login` and sign in
3. **Forgot Password**: Go to `/forgot-password` to test password reset flow

## 📝 Notes

- Supabase Auth is now used for signup/login/forgot password
- The existing NextAuth setup still works for API routes
- Email verification can be enabled/disabled in Supabase settings
- All password management is handled by Supabase (secure!)

## 🔗 Links

- Sign Up: http://localhost:3000/signup
- Login: http://localhost:3000/login
- Forgot Password: http://localhost:3000/forgot-password

