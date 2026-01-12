# Testing Patient Portal Locally

## Quick Start

The patient portal is implemented on the `feature/patient-portal` branch. To test it locally:

### 1. Database Setup

The schema has been extended with patient portal models. You have two options:

**Option A: Use `prisma db push` (Recommended for development)**
```bash
npx prisma db push
```
This pushes schema changes directly without creating migration files (good for rapid development).

**Option B: Create and apply migration**
```bash
# For Supabase/remote databases, you might need to skip shadow database
PRISMA_MIGRATE_SKIP_GENERATE=1 npx prisma migrate dev --name add_patient_portal
```

### 2. Start Dev Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 3. Test Portal Routes

#### Portal Authentication
- Navigate to: `http://localhost:3000/portal/auth`
- Enter email or phone number
- Request OTP (currently logs to console - needs Twilio/SendGrid integration)
- Verify OTP code

#### Portal API Routes
All routes require:
1. Practice context (subdomain routing) - for local testing, you may need to:
   - Add a `slug` to a practice in the database
   - Access via subdomain or modify `getPracticeContext` to use a default practice

2. Patient session (after OTP login)

**Available Routes:**
- `GET /api/portal/me` - Get current patient
- `POST /api/portal/auth/otp` - Request OTP
- `POST /api/portal/auth/verify` - Verify OTP
- `GET /api/portal/threads` - Get conversation threads
- `POST /api/portal/feedback` - Submit feedback
- `GET /api/portal/timeline` - Get activity timeline
- And more...

### 4. Testing with Subdomain Routing

For subdomain testing locally, you can:

**Option A: Use `/etc/hosts` (Mac/Linux)**
```bash
# Add to /etc/hosts
127.0.0.1 demo.portal.getvantage.tech
```

**Option B: Modify tenant resolution for local dev**
Add a default practice fallback in `src/lib/tenant.ts` for `localhost:3000`

### 5. Create Test Data

You'll need:
1. A Practice with a `slug` (e.g., "demo")
2. A Patient with email/phone
3. A PatientAccount for the patient

You can add this via Prisma Studio:
```bash
npx prisma studio
```

Or create a seed script to add test data.

### 6. OTP Testing

Currently, OTPs are logged to the console (check terminal output). To test the full flow:

1. Request OTP via `/api/portal/auth/otp`
2. Check console for the OTP code
3. Verify OTP via `/api/portal/auth/verify`

**Note:** For production, integrate Twilio (SMS) and SendGrid (email) in `src/lib/patient-auth.ts` `sendOTP()` function.

### 7. Testing Webhooks

#### Twilio Webhook (STOP handling)
- Configure Twilio webhook URL to: `http://your-domain.com/api/webhooks/twilio`
- For local testing, use ngrok: `ngrok http 3000`
- Test by sending "STOP" to your Twilio number

### Current Limitations

1. **OTP Delivery**: Currently logs to console (not actually sent)
2. **Subdomain Routing**: Requires subdomain setup for local testing
3. **Session Management**: Uses simple cookies (works for local dev)
4. **Migrations**: Shadow database issues with remote databases (use `db push` instead)

### Next Steps

1. Integrate Twilio/SendGrid for actual OTP delivery
2. Add seed data script for testing
3. Build additional UI pages (messages, appointments, etc.)
4. Add middleware for portal routes
5. Create integration tests

## Troubleshooting

**Migration Errors:**
- Use `prisma db push` instead of `migrate dev` for remote databases
- Or set `PRISMA_MIGRATE_SKIP_GENERATE=1`

**Portal Not Loading:**
- Check that a practice exists with a `slug`
- Check browser console for errors
- Verify patient session cookie is set

**OTP Not Working:**
- Check console logs for OTP code
- Verify patient exists in database
- Check PatientAccount is created
