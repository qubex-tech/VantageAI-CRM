# Domain-Based Routing Configuration

## Overview

The application uses domain-based routing to separate the CRM (staff/admin interface) from the Patient Portal:

- **CRM Domain**: `app.getvantage.tech` (or `getvantage.tech`)
  - Staff/admin authentication
  - Patient management
  - Appointments management
  - Settings
  - Automations/Workflows
  - Marketing templates
  
- **Portal Domain**: `portal.getvantage.tech`
  - Patient authentication (OTP-based)
  - Patient portal pages (`/portal/auth`, `/portal/appointments`, etc.)
  - Portal API routes (`/api/portal/*`)

## Domain Detection

The middleware (`src/middleware.ts`) detects the domain from the `host` header and routes accordingly:

### Portal Domain (`portal.getvantage.tech`)
- Allows: `/portal/*` routes and `/api/portal/*` API routes
- Blocks: All CRM routes (`/dashboard`, `/patients`, `/appointments`, `/settings`, etc.)
- Redirects: Root path (`/`) and `/portal` to `/portal/auth`
- Allows: Webhook endpoints (shared infrastructure)

### CRM Domain (`app.getvantage.tech` or `getvantage.tech`)
- Allows: All CRM routes
- Blocks: Portal routes (`/portal/*`)
- Requires: Supabase authentication for protected routes
- Allows: Auth pages (`/login`, `/signup`, etc.) and webhook endpoints

## Vercel Configuration

To deploy both domains to the same Vercel project:

1. **Add domains in Vercel Dashboard**:
   - Go to Project Settings → Domains
   - Add `app.getvantage.tech` (CRM)
   - Add `portal.getvantage.tech` (Portal)

2. **DNS Configuration**:
   - Point `app.getvantage.tech` to Vercel
   - Point `portal.getvantage.tech` to Vercel
   - Both should resolve to the same Vercel deployment

3. **Environment Variables**:
   - No additional environment variables needed
   - Middleware automatically detects the domain from the request

## Subdomain Routing

The portal supports subdomain-based multi-tenancy:
- `{slug}.portal.getvantage.tech` - Practice-specific portal
- Example: `demo.portal.getvantage.tech` → Practice with slug "demo"

See `src/lib/tenant.ts` for tenant resolution logic.

## Testing Locally

To test domain-based routing locally, add to `/etc/hosts`:

```
127.0.0.1 app.getvantage.tech
127.0.0.1 portal.getvantage.tech
127.0.0.1 demo.portal.getvantage.tech
```

Then access:
- `http://app.getvantage.tech:3000` - CRM
- `http://portal.getvantage.tech:3000` - Portal
- `http://demo.portal.getvantage.tech:3000` - Practice-specific portal
