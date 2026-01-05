# Healix Assistant v1

Healix is an embedded AI assistant for the Medical CRM that provides operational support without clinical advice. It's designed as a Comet-style right-side drawer that's always accessible across the application.

## Features

- **Context-Aware**: Automatically detects current page context (route, patient ID, appointment ID, etc.)
- **Streaming Responses**: Real-time streaming of AI responses using Server-Sent Events (SSE)
- **Suggested Actions**: Provides 1-3 low-risk operational actions with one-click execution
- **Multi-Tenant**: All operations are scoped to the user's clinic/practice
- **Auditable**: Every prompt, tool call, and action is logged for compliance
- **Safety-First**: Never provides clinical advice; only operational help

## Setup

### Environment Variables

Add the following to your `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
```

### Database Migration

Run the Prisma migration to create the Healix tables:

```bash
npm run db:migrate
```

Or if you need to create the migration manually:

```bash
npx prisma migrate dev --name add_healix_models
```

### Generate Prisma Client

After adding the schema, generate the Prisma client:

```bash
npx prisma generate
```

## Usage

### Accessing Healix

1. **Button**: Click the "Healix" button in the top-right header
2. **Keyboard Shortcut**: Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open and focus

### Using Healix

1. Type your question in the chat input
2. Healix will analyze your question with the current page context
3. Review suggested actions (if any)
4. Click "Execute" on any suggested action to run it immediately

### Context Detection

Healix automatically detects:
- Current route/pathname
- Patient ID (if on a patient page)
- Appointment ID (if on an appointment page)
- Invoice ID (if on an invoice page)
- Visible fields (if explicitly passed)
- Recent timeline events (for patients)

## Available Tools

Healix can execute the following low-risk operations:

### 1. `createTask`
Create an internal task linked to a patient or appointment.

```typescript
{
  clinicId: string
  patientId?: string
  appointmentId?: string
  title: string
  dueAt?: Date
  priority?: 'low' | 'medium' | 'high'
}
```

### 2. `createNote`
Create a note for a patient or appointment.

```typescript
{
  clinicId: string
  patientId?: string
  appointmentId?: string
  content: string
}
```

### 3. `draftMessage`
Draft an SMS or email message (doesn't send, just prepares).

```typescript
{
  clinicId: string
  patientId: string
  channel: 'sms' | 'email'
  content: string
}
```

### 4. `updatePatientFields`
Update non-sensitive patient fields only.

```typescript
{
  clinicId: string
  patientId: string
  patch: {
    preferredName?: string
    contactPreferences?: string
    language?: string
    marketingOptIn?: boolean
  }
}
```

### 5. `searchPatients`
Search for patients by name, phone, or email.

```typescript
{
  clinicId: string
  query: string
}
```

### 6. `getPatientSummary`
Get detailed patient information including recent appointments, insurance, and timeline.

```typescript
{
  clinicId: string
  patientId: string
}
```

### 7. `getAppointmentSummary`
Get appointment details including patient information.

```typescript
{
  clinicId: string
  appointmentId: string
}
```

## API Routes

### POST `/api/healix/chat`

Streaming chat endpoint that processes user messages with context.

**Request:**
```json
{
  "conversationId": "optional-conversation-id",
  "userMessage": "How can I help with this patient?",
  "contextPayload": {
    "route": "/patients/123",
    "screenTitle": "Patient Details",
    "patientId": "patient-id",
    "visibleFields": { "name": "John Doe", "phone": "555-1234" }
  }
}
```

**Response:** Server-Sent Events (SSE) stream with:
- `type: 'token'` - Streaming tokens
- `type: 'suggested_actions'` - Suggested actions array
- `type: 'done'` - Stream complete
- `type: 'error'` - Error occurred

### POST `/api/healix/action`

Execute a suggested action or direct tool call.

**Request:**
```json
{
  "conversationId": "conversation-id",
  "actionId": "action-id",  // If using suggested action
  "tool": "createTask",      // If direct tool call
  "args": { ... }            // Tool arguments
}
```

**Response:**
```json
{
  "success": true,
  "message": "Action executed successfully",
  "result": { ... }
}
```

## Integration in Pages

To pass page-specific context to Healix, use the `useHealixContext` hook:

```tsx
'use client'

import { useHealixContext } from '@/hooks/useHealixContext'
import { HealixButton } from '@/components/healix/HealixButton'

export default function PatientPage({ patient }) {
  const { context } = useHealixContext({
    patientId: patient.id,
    screenTitle: 'Patient Details',
    visibleFields: {
      name: patient.name,
      phone: patient.phone,
      email: patient.email,
    },
  })

  return (
    <div>
      {/* Page content */}
      <HealixButton
        patientId={patient.id}
        screenTitle="Patient Details"
        visibleFields={context.visibleFields}
      />
    </div>
  )
}
```

## Safety & Guardrails

### System Prompt Rules

The Healix system prompt enforces:
- ❌ **No clinical advice** - Never provides diagnosis or treatment recommendations
- ❌ **No medical interventions** - Never suggests medications or procedures
- ✅ **Operational help only** - Assists with tasks, notes, messages, and data lookup
- ✅ **Acknowledge limitations** - States when data is insufficient
- ✅ **Require confirmation** - Explicit user confirmation before executing actions (unless clicking suggested action)

### Tool Allowlist

Only pre-approved tools can be executed. The allowlist is enforced both:
1. **Client-side**: Tool names validated before API calls
2. **Server-side**: Tool names validated again in the API route

### Permission Checks

Every tool execution:
- Validates user belongs to the clinic (`practiceId` scoping)
- Checks user has permission to access the resource
- Logs all actions for audit trail

### PHI/PII Handling

- Full PHI (DOB, SSN) is not stored in logs
- Only IDs and metadata are logged
- Sensitive fields are redacted in audit logs

## Database Schema

### HealixConversation
Stores conversation sessions.

```prisma
model HealixConversation {
  id         String   @id @default(uuid())
  practiceId String
  userId     String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  messages   HealixMessage[]
  actionLogs HealixActionLog[]
}
```

### HealixMessage
Stores individual messages in conversations.

```prisma
model HealixMessage {
  id             String   @id @default(uuid())
  conversationId String
  role           String   // 'user', 'assistant', 'tool'
  content        Json
  createdAt      DateTime @default(now())
}
```

### HealixActionLog
Audit log for all tool executions.

```prisma
model HealixActionLog {
  id             String   @id @default(uuid())
  conversationId String?
  userId         String
  practiceId     String
  actionType     String
  toolName       String?
  toolArgs       Json?
  toolResult     Json?
  createdAt      DateTime @default(now())
}
```

## Testing

Run unit tests:

```bash
npm test
```

Test specific file:

```bash
npm test healix-tools
```

## Rate Limiting

For v1, rate limiting is implemented using a simple in-memory token bucket. Future versions may use database-backed rate limiting for distributed systems.

## Limitations

### v1 Limitations

- In-memory rate limiting (not distributed)
- Only low-risk operations supported
- Patient model may need additional fields for `preferredName`, `language`, `marketingOptIn`
- No support for high-risk actions (modifying sensitive medical data)
- No real-time collaboration features

### Future Enhancements

- Database-backed rate limiting
- More sophisticated context detection
- Support for more complex workflows
- Integration with calendar scheduling
- Batch operations
- Custom tool creation by practices

## Troubleshooting

### Healix button not appearing

1. Check that the Header component is rendered in the layout
2. Verify `HealixButton` is imported correctly
3. Check browser console for errors

### Streaming not working

1. Verify `OPENAI_API_KEY` is set in environment variables
2. Check browser network tab for SSE stream
3. Verify OpenAI API has streaming enabled for your model

### Actions not executing

1. Check user has permission to access the clinic
2. Verify tool name is in the allowlist
3. Check action logs in database for error details
4. Ensure `clinicId` (practiceId) is provided in args

### Context not being detected

1. Use `useHealixContext` hook in your page component
2. Pass explicit `patientId`, `appointmentId`, etc. to `HealixButton`
3. Check browser console for context payload in API calls

## Support

For issues or questions about Healix, please contact the development team or create an issue in the repository.

---

**Version:** 1.0.0  
**Last Updated:** January 2025

