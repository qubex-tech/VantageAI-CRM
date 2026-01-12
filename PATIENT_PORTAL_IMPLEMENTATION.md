# Patient Portal Implementation Status

## ✅ Completed

### 1. Database Schema (Prisma)
- ✅ Extended `Practice` model with `slug` and `portalDomain` fields
- ✅ Added all patient portal models:
  - `PatientAccount` - Patient authentication
  - `GuardianRelationship` - Guardian/dependent relationships
  - `ConsentRecord` - Consent tracking
  - `CommunicationPreference` - Communication preferences
  - `ConversationThread` - Message threads
  - `PortalMessage` - Messages (PORTAL | SMS | EMAIL | VOICE)
  - `PatientTask` - Intake tasks
  - `FormSubmission` - Form submissions
  - `DocumentUpload` - Document uploads
  - `ReviewRequest` - Review requests
  - `Feedback` - NPS/CSAT/Reviews
  - `ReferralLink` - Referral links
  - `ReferralAttribution` - Referral tracking
  - `Campaign` - Marketing campaigns
  - `CampaignEnrollment` - Campaign enrollments
  - `CampaignEvent` - Campaign events
  - `PortalAuditLog` - Portal audit logs
  - `AnalyticsEvent` - Analytics events

### 2. Tenant Resolution
- ✅ Created `src/lib/tenant.ts` with:
  - `getPracticeContext()` - Parse host header, resolve practice via slug/domain
  - `requirePracticeContext()` - Require practice context
  - `getPracticeContextFromToken()` - Token-based fallback

### 3. Patient Authentication
- ✅ Created `src/lib/patient-auth.ts` with:
  - `generateOTP()` - Generate 6-digit OTP
  - `hashOTP()` / `verifyOTP()` - OTP hashing/verification
  - `createPatientOTP()` - Create and send OTP
  - `verifyPatientOTP()` - Verify OTP code
  - `generateInviteToken()` / `verifyInviteToken()` - Invite tokens

### 4. Validation Schemas
- ✅ Added portal validation schemas to `src/lib/validations.ts`:
  - `patientOTPRequestSchema`
  - `patientOTPVerifySchema`
  - `consentUpdateSchema`
  - `communicationPreferenceSchema`
  - `messageCreateSchema`
  - `appointmentConfirmSchema`
  - `appointmentCancelSchema`
  - `appointmentRescheduleRequestSchema`
  - `feedbackSchema`
  - `referralCreateSchema`

### 5. Core API Routes
- ✅ `/api/portal/me` - Get current patient
- ✅ `/api/portal/consent` - Update consent
- ✅ `/api/portal/preferences` - Get/update communication preferences
- ✅ `/api/portal/threads` - Get conversation threads
- ✅ `/api/portal/threads/[id]/messages` - Get/create messages

## 🚧 Remaining Work

### 1. API Routes (High Priority)
- ✅ `/api/portal/appointments/[id]/confirm` - Confirm appointment
- ✅ `/api/portal/appointments/[id]/cancel` - Cancel appointment
- ✅ `/api/portal/appointments/[id]/reschedule-request` - Request reschedule
- [ ] `/api/portal/appointments/[id]/waitlist` - Join waitlist
- ✅ `/api/portal/tasks` - Get/update tasks
- [ ] `/api/portal/uploads` - Upload documents
- ✅ `/api/portal/feedback` - Submit feedback
- [ ] `/api/portal/referrals` - Create referral
- ✅ `/api/portal/timeline` - Get unified timeline
- ✅ `/api/portal/auth/otp` - Request OTP
- ✅ `/api/portal/auth/verify` - Verify OTP
- ✅ `/api/webhooks/twilio` - Twilio webhook (STOP handling)
- [ ] `/api/webhooks/email` - Email webhook

### 2. Patient Session Management
- ✅ Implement patient session storage (cookies)
- ✅ Helper to extract patient ID from session
- ✅ Separate from staff auth (NextAuth)

### 3. UI Pages (Notion-inspired)
- ✅ `/portal` - Home (redirects to auth)
- [ ] `/portal/messages` - Unified inbox
- [ ] `/portal/appointments` - Appointment management
- [ ] `/portal/intake` - Intake tasks
- [ ] `/portal/preferences` - Communication preferences
- [ ] `/portal/feedback` - NPS/CSAT
- [ ] `/portal/referrals` - Referral sharing
- [ ] `/portal/activity` - Unified timeline
- ✅ `/portal/auth` - OTP login

### 4. Messaging System
- [ ] Unified inbox UI
- [ ] PHI safety checks (SMS/email = PHI-safe only)
- [ ] Template system integration
- [ ] Thread management

### 5. Webhooks
- [ ] Twilio STOP handling with idempotency
- [ ] Email unsubscribe handling
- [ ] Message delivery status updates

### 6. Automation Integration
- [ ] Patient lifecycle triggers
- [ ] Automation actions for portal

### 7. Twilio Integration
- [ ] SMS sending
- [ ] OTP delivery
- [ ] STOP keyword handling

### 8. Testing
- [ ] Unit tests (consent, STOP handling, preferences)
- [ ] Integration tests (Twilio webhook, timeline)
- [ ] Seed data for portal testing

## Architecture Notes

### Multi-Tenant Routing
- Subdomain-based: `{slug}.portal.getvantage.tech`
- Custom domain mapping: `portalDomain` field
- Token-based fallback: Invite links

### Authentication Flow
1. Patient requests OTP (email/SMS)
2. System generates OTP, stores hash
3. OTP sent via SendGrid/Twilio
4. Patient verifies OTP
5. Session created (patient ID in session)
6. All requests require practice context + patient session

### Data Isolation
- All queries scoped to `practiceId`
- Patient-scoped queries use `patientId`
- Tenant enforcement at API layer
- Audit logs for all actions

### PHI Safety
- Portal messages: PHI allowed
- SMS/Email messages: PHI-safe only (templates enforce)
- Template system flags `PHI_ALLOWED`
- Variable allowlists per channel

## Next Steps

1. **Run Migration**: Generate Prisma client and run migration
   ```bash
   npx prisma generate
   npx prisma migrate dev --name add_patient_portal
   ```

2. **Implement Patient Session**: Create session management separate from staff auth

3. **Complete API Routes**: Finish remaining portal API routes

4. **Build UI**: Create Notion-inspired portal pages

5. **Integrate Twilio**: Add SMS capabilities

6. **Add Seed Data**: Create test data for portal

7. **Write Tests**: Unit and integration tests

## Files Created

- `prisma/schema.prisma` - Extended with portal models
- `src/lib/tenant.ts` - Tenant resolution
- `src/lib/patient-auth.ts` - Patient authentication
- `src/lib/validations.ts` - Portal validation schemas
- `src/app/api/portal/me/route.ts`
- `src/app/api/portal/consent/route.ts`
- `src/app/api/portal/preferences/route.ts`
- `src/app/api/portal/threads/route.ts`
- `src/app/api/portal/threads/[id]/messages/route.ts`
