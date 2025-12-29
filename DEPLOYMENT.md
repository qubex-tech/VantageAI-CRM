# Deployment Guide: Vantage AI on Custom Domain

This guide will walk you through deploying Vantage AI to Vercel with a custom domain.

## Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com) (free tier is fine)
3. **Custom Domain** - A domain name you own (e.g., `vantage-ai.com`)
4. **Supabase Project** - Already set up (you're using it for database and auth)
5. **Cal.com Account** - For scheduling integration
6. **RetellAI Account** - For voice agent integration

## Step 1: Prepare Your Repository

1. **Ensure all code is committed and pushed to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Create/verify `.env.example` file** (should already exist):
   - This helps document required environment variables
   - **DO NOT commit `.env` file** - it contains secrets

## Step 2: Set Up Vercel Deployment

### 2.1 Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
   - Select the repository containing Vantage AI
   - Vercel will auto-detect Next.js settings
4. Configure project settings:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

### 2.2 Configure Environment Variables

Before deploying, add all environment variables in Vercel:

1. In the project settings, go to **Settings** → **Environment Variables**
2. Add the following variables (use the same values from your local `.env`):

#### Required Environment Variables:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres.yxmtekolhhyeypicyfzq:YOUR_PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://yxmtekolhhyeypicyfzq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NextAuth (if still using - optional)
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-key-here

# Webhook Secrets (optional but recommended)
RETELLAI_WEBHOOK_SECRET=your-retell-webhook-secret
CAL_WEBHOOK_SECRET=your-cal-webhook-secret
```

**Important Notes:**
- Set `NEXTAUTH_URL` to your production domain once you have it
- Generate a new `NEXTAUTH_SECRET` for production: `openssl rand -base64 32`
- For **Environment**, select **Production**, **Preview**, and **Development** (or just Production for now)

### 2.3 Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (2-5 minutes)
3. Once deployed, you'll get a Vercel URL like: `vantage-ai.vercel.app`

## Step 3: Configure Custom Domain

### 3.1 Add Domain in Vercel

1. Go to your project → **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `vantage-ai.com` or `app.vantage-ai.com`)
4. Vercel will show you DNS configuration instructions

### 3.2 Configure DNS Records

You need to add DNS records in your domain registrar (where you bought the domain):

#### Option A: Root Domain (vantage-ai.com)

Add an **A record** pointing to Vercel's IP:
- **Type:** A
- **Name:** `@` (or leave blank for root)
- **Value:** `76.76.21.21`
- **TTL:** 3600 (or default)

#### Option B: Subdomain (app.vantage-ai.com) - Recommended

Add a **CNAME record**:
- **Type:** CNAME
- **Name:** `app` (or your subdomain)
- **Value:** `cname.vercel-dns.com.`
- **TTL:** 3600 (or default)

**Recommended:** Use a subdomain (Option B) as it's simpler and more flexible.

### 3.3 Verify DNS Configuration

1. In Vercel, click **"Refresh"** on the domain settings page
2. Wait for DNS propagation (can take 5 minutes to 48 hours, usually within 1 hour)
3. Once verified, Vercel will show "Valid Configuration"

### 3.4 SSL Certificate

- Vercel automatically provisions SSL certificates via Let's Encrypt
- HTTPS will be enabled automatically once DNS is configured
- No additional action needed

## Step 4: Update Environment Variables for Production

### 4.1 Update NEXTAUTH_URL

1. Go to **Settings** → **Environment Variables**
2. Update `NEXTAUTH_URL` to your custom domain:
   ```
   NEXTAUTH_URL=https://app.vantage-ai.com
   ```
3. Redeploy (or it will auto-update on next deployment)

### 4.2 Update Webhook URLs

#### Cal.com Webhooks:

1. Go to Cal.com → Settings → Webhooks
2. Add webhook URL: `https://app.vantage-ai.com/api/cal/webhook`
3. Update the webhook secret if needed

#### RetellAI Webhooks:

1. Go to RetellAI Dashboard → Webhooks
2. Add webhook URL: `https://app.vantage-ai.com/api/retell/webhook`
3. Update the webhook secret in Vercel environment variables

## Step 5: Database Configuration

### 5.1 Supabase Connection Pooling

Your `DATABASE_URL` should use Supabase's **Session Pooler** (which you're already using):
```
postgresql://postgres.yxmtekolhhyeypicyfzq:password@aws-0-us-west-2.pooler.supabase.com:5432/postgres
```

**Important:** 
- Use port `5432` for session pooling (better for serverless)
- Don't use direct connection (port 6543) for Vercel

### 5.2 Database Migrations

Run migrations on your production database:

```bash
# Set production DATABASE_URL temporarily
export DATABASE_URL="your-production-database-url"

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

Or use Vercel's build command to handle this automatically (recommended).

### 5.3 Update Vercel Build Command (Optional)

If you want migrations to run automatically:

1. Go to **Settings** → **General** → **Build & Development Settings**
2. Update **Build Command:**
   ```bash
   npx prisma generate && npx prisma migrate deploy && npm run build
   ```

**Note:** This runs migrations on every deployment. Only do this if you're comfortable with that approach.

## Step 6: Post-Deployment Checklist

- [ ] Verify site loads at custom domain with HTTPS
- [ ] Test user signup/login flow
- [ ] Verify Supabase authentication works
- [ ] Test patient CRUD operations
- [ ] Test appointment scheduling with Cal.com
- [ ] Verify RetellAI integration (if configured)
- [ ] Check that webhooks are accessible
- [ ] Verify database connections are working
- [ ] Test on mobile devices (mobile-first design)
- [ ] Check browser console for errors
- [ ] Verify environment variables are set correctly

## Step 7: Continuous Deployment

Vercel automatically deploys when you push to your main branch:

1. Make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. Vercel automatically builds and deploys
4. Preview deployments are created for pull requests

## Step 8: Monitoring & Maintenance

### 8.1 Vercel Analytics (Optional)

1. Go to **Analytics** tab in Vercel
2. Enable Vercel Analytics (free tier available)
3. Monitor page views, performance, etc.

### 8.2 Error Monitoring (Recommended)

Consider adding error monitoring:
- **Sentry** (has Next.js integration)
- **LogRocket**
- Or use Vercel's built-in logs

### 8.3 Database Backups

- Supabase provides automatic backups
- Configure backup retention in Supabase dashboard
- Consider setting up additional backup strategies for production

## Step 9: Security Checklist

- [ ] All environment variables are set in Vercel (not in code)
- [ ] `NEXTAUTH_SECRET` is a strong, random value
- [ ] Webhook secrets are configured and verified
- [ ] HTTPS is enforced (automatic with Vercel)
- [ ] Database connection uses SSL (Supabase defaults)
- [ ] API keys are stored securely (encrypted in database)
- [ ] Rate limiting is enabled (already implemented)
- [ ] CORS is properly configured (if needed)

## Troubleshooting

### Build Failures

1. Check Vercel build logs
2. Verify all environment variables are set
3. Ensure `package.json` has correct build scripts
4. Check for TypeScript errors locally first

### Database Connection Issues

1. Verify `DATABASE_URL` uses session pooler (port 5432)
2. Check Supabase connection pooling settings
3. Ensure database is not paused in Supabase
4. Check IP allowlist if configured

### Custom Domain Not Working

1. Verify DNS records are correct
2. Wait for DNS propagation (use `dig` or online DNS checker)
3. Check domain settings in Vercel
4. Ensure domain is not using CDN that might cache old records

### Webhooks Not Working

1. Verify webhook URLs are correct (use custom domain)
2. Check webhook secrets match
3. Test webhook endpoints manually
4. Check Vercel function logs

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Custom Domain Setup](https://vercel.com/docs/concepts/projects/domains)

## Support

For issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Review browser console errors
4. Check server logs in Vercel dashboard

