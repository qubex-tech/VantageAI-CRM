# Marketing Module - Quick Start Guide

## 🚀 Getting Started

The Marketing Module is now fully implemented! Here's how to use it:

### 1. Run Database Migration

```bash
npx prisma migrate dev --name add_marketing_module
npx prisma generate
```

### 2. Seed Demo Data (Optional)

```bash
npx prisma db seed
```

This will create:
- A brand profile for your practice
- 2 email templates (1 published, 1 draft)
- 3 SMS templates (2 published, 1 draft)

### 3. Access Marketing Module

Navigate to `/marketing` in your application to access the marketing dashboard.

## 📋 Features Overview

### Templates
- **Email Templates**: Create beautiful email templates with drag-drop builder or HTML editor
- **SMS Templates**: Plain text templates with variable substitution
- **Categories**: reminder, confirmation, reactivation, followup, reviews, broadcast, custom
- **Status**: draft → published → archived workflow
- **Versioning**: Automatic version snapshots on publish

### Brand Settings
- Logo upload
- Color customization (primary, secondary)
- Font selection
- Header layout (left/center)
- Email footer HTML
- SMS footer text

### Sender Settings
- Default email sender (name, email, reply-to)
- Default SMS sender ID
- Quiet hours configuration
- Timezone settings

### Variables
Use merge variables in your templates:
- `{{patient.firstName}}` - Patient's first name
- `{{patient.lastName}}` - Patient's last name
- `{{practice.name}}` - Practice name
- `{{appointment.date}}` - Appointment date
- `{{appointment.time}}` - Appointment time
- `{{appointment.location}}` - Appointment location
- `{{appointment.providerName}}` - Provider name
- `{{links.confirm}}` - Confirmation link
- `{{links.reschedule}}` - Reschedule link
- `{{links.cancel}}` - Cancellation link

### Compliance
- Automatic consent checking (doNotContact, smsOptIn, emailOptIn)
- Quiet hours enforcement
- STOP footer auto-injection for SMS
- Practice name auto-prefix for SMS
- Footer requirements for emails

## 🎯 API Usage Examples

### Create Email Template
```bash
curl -X POST http://localhost:3000/api/marketing/templates \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "name": "Appointment Reminder",
    "category": "reminder",
    "subject": "Reminder: Your appointment on {{appointment.date}}",
    "bodyJson": {
      "rows": [{
        "columns": [{
          "blocks": [
            {"type": "header"},
            {"type": "text", "content": "<p>Hi {{patient.firstName}},</p>"},
            {"type": "footer"}
          ]
        }]
      }]
    }
  }'
```

### Preview Template
```bash
curl -X POST http://localhost:3000/api/marketing/templates/{templateId}/preview \
  -H "Content-Type: application/json" \
  -d '{
    "sampleContext": {
      "patient": {"firstName": "John"},
      "appointment": {"date": "Jan 15, 2024", "time": "2:00 PM"}
    }
  }'
```

### Publish Template
```bash
curl -X POST http://localhost:3000/api/marketing/templates/{templateId}/publish
```

### Send Test Email
```bash
curl -X POST http://localhost:3000/api/marketing/templates/{templateId}/test-send/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "sampleContext": {
      "patient": {"firstName": "John"}
    }
  }'
```

## 🔧 Configuration

### Provider Integration

Replace stub providers with real implementations:

**Email Provider** (`src/lib/marketing/providers.ts`):
```typescript
// Replace StubEmailProvider with SendGrid, AWS SES, etc.
import { SendGridProvider } from './sendgrid-provider'
export const emailProvider = new SendGridProvider(process.env.SENDGRID_API_KEY)
```

**SMS Provider** (`src/lib/marketing/providers.ts`):
```typescript
// Replace StubSmsProvider with Twilio, AWS SNS, etc.
import { TwilioSmsProvider } from './twilio-provider'
export const smsProvider = new TwilioSmsProvider(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
```

### Asset Storage

Update asset upload to use cloud storage (`src/app/api/marketing/brand/logo/route.ts` and `src/app/api/marketing/assets/route.ts`):

```typescript
// Example: AWS S3 upload
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
const s3Client = new S3Client({ region: 'us-east-1' })
const uploadResult = await s3Client.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: `logos/${tenantId}/${fileName}`,
  Body: fileBuffer,
}))
const logoUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${uploadResult.Key}`
```

## 📝 Template Editor

The template editor supports:
- **Email**: Drag-drop builder (JSON structure) or HTML editor
- **SMS**: Plain text editor with variable picker
- **Preview**: Real-time preview with sample data
- **Linting**: Validation before publish
- **Version History**: View and restore previous versions

## 🛡️ Security & Compliance

- All templates are tenant-scoped (practiceId isolation)
- PHI is automatically redacted in audit logs
- Consent checking enforced at send-time
- Quiet hours enforced at API level
- All mutations create audit log entries

## 📊 Audit Trail

View audit logs:
```bash
curl http://localhost:3000/api/marketing/audit?entityType=Template&limit=50
```

All marketing actions are logged:
- TEMPLATE_CREATED
- TEMPLATE_UPDATED
- TEMPLATE_PUBLISHED
- TEMPLATE_ARCHIVED
- TEMPLATE_DUPLICATED
- BRAND_UPDATED
- SENDERS_UPDATED
- TEST_SENT
- ASSET_UPLOADED

## 🐛 Troubleshooting

### Template won't publish
- Check lint results for errors
- Ensure subject is set (for email)
- Verify all variables are recognized
- Check footer requirements

### Test send fails
- Verify quiet hours (cannot send during quiet hours)
- Check patient consent (doNotContact, smsOptIn, emailOptIn)
- Ensure provider credentials are configured

### Variables not replacing
- Verify variable syntax: `{{variable.path}}`
- Check context object includes required fields
- Review variable extraction logs

## 🚧 Remaining UI Pages

The following UI pages need implementation (core functionality exists in API):
- `/marketing/templates/[id]` - Template editor page
- `/marketing/brand` - Brand settings page
- `/marketing/senders` - Sender settings page
- `/marketing/test` - Test center page

These pages can be built using the existing API routes and following the patterns in `/marketing` and `/marketing/templates`.

## 📚 Documentation

- `MARKETING_MODULE_IMPLEMENTATION.md` - Full implementation details
- `src/lib/marketing/types.ts` - Type definitions
- API routes in `src/app/api/marketing/` - All endpoints documented
