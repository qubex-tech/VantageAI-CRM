# Vantage AI - Architecture Overview

## System Architecture

### High-Level Design
- **Frontend**: Next.js 14+ App Router with React Server Components
- **Backend**: Next.js Route Handlers (API routes)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials provider + session management
- **Multi-tenancy**: Row-level security via `practiceId` on all tenant tables
- **External Integrations**:
  - Cal.com API for appointment scheduling
  - RetellAI webhooks for voice agent interactions

### Multi-Tenancy Strategy
- **Isolation**: Row-level isolation using `practiceId` foreign key
- **Enforcement**:
  - Prisma middleware/helpers enforce `practiceId` in queries
  - API route middleware extracts `practiceId` from session
  - UI routing is practice-aware
- **Data Model**: Each tenant (Practice) has isolated data (Patients, Appointments, etc.)

### Folder Structure
```
/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration files
│   └── seed.ts                # Seed data script
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/
│   │   │   └── login/         # Login page
│   │   ├── (main)/
│   │   │   ├── dashboard/     # Dashboard page
│   │   │   ├── patients/      # Patient list & detail pages
│   │   │   ├── appointments/  # Appointments list
│   │   │   └── settings/      # Practice settings
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth routes
│   │   │   ├── patients/      # Patient CRUD
│   │   │   ├── appointments/  # Appointment management
│   │   │   ├── insurance/     # Insurance CRUD
│   │   │   ├── cal/           # Cal.com webhook
│   │   │   └── retell/        # RetellAI webhook
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── layout/            # Layout components (Nav, BottomNav)
│   │   ├── patients/          # Patient-related components
│   │   ├── appointments/      # Appointment components
│   │   └── forms/             # Reusable form components
│   ├── lib/
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── db.ts              # Prisma client with tenant helpers
│   │   ├── middleware.ts      # Tenant isolation middleware
│   │   ├── cal.ts             # Cal.com API client
│   │   ├── retell.ts          # RetellAI webhook handlers
│   │   ├── agentActions.ts    # Voice agent action handlers
│   │   ├── audit.ts           # Audit logging helpers
│   │   ├── phi.ts             # PHI redaction utilities
│   │   └── validations.ts     # Zod schemas
│   ├── types/                 # TypeScript types
│   └── middleware.ts          # Next.js middleware (auth redirects)
├── tests/
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
├── scripts/
│   └── simulate-retell.ts     # RetellAI webhook simulation script
├── .env.example               # Environment variables template
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

### Data Flow

#### Authentication Flow
1. User logs in via NextAuth credentials provider
2. Session contains `userId` and `practiceId`
3. All subsequent requests use `practiceId` for tenant isolation

#### Appointment Booking Flow
1. User selects patient → "Schedule Appointment"
2. Choose visit type (maps to Cal event type)
3. Fetch available slots from Cal.com API
4. User selects time slot
5. Create Cal.com booking via API
6. Store local Appointment record with `calBookingId`
7. Write audit log entry
8. Show confirmation

#### RetellAI Voice Agent Flow
1. Caller phones in → RetellAI handles conversation
2. RetellAI webhook sends tool call request
3. System processes action (find patient, get slots, book appointment)
4. Response sent back to RetellAI
5. Voice conversation logged to VoiceConversation table
6. Audit log entry created

### Security Measures
- **PHI Redaction**: Regex-based redaction for phone/email in logs
- **Rate Limiting**: Token bucket for webhook endpoints
- **Input Validation**: Zod schemas for all API inputs
- **Webhook Verification**: Signature validation for Cal.com and RetellAI
- **Tenant Isolation**: Enforced at database query and API middleware levels

### Key Design Decisions
1. **Monorepo with Next.js API routes**: Simplest architecture, serverless-friendly
2. **Row-level multi-tenancy**: Scales well, clear data boundaries
3. **Cal.com API key per practice**: Stored encrypted in DB (env for demo)
4. **Soft deletes**: Prefer `deletedAt` over hard deletes for auditability
5. **Mobile-first UI**: shadcn/ui with responsive Tailwind classes

