# Vantage AI

A production-ready, mobile-first, multi-tenant CRM for medical practices with Cal.com scheduling and RetellAI voice agent integration.

## Features

- **Multi-tenant Architecture**: Row-level tenant isolation with practice-based data separation
- **Patient Management**: Complete patient CRM with insurance tracking, timeline, and tags
- **Appointment Scheduling**: Integration with Cal.com for appointment booking
- **Voice Agent Integration**: RetellAI webhook support for voice-driven appointment booking
- **Mobile-First UI**: Responsive design with mobile navigation
- **Audit Logging**: Comprehensive audit trail for all actions
- **PHI Protection**: Built-in PHI redaction for logs and transcripts

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials provider
- **Integrations**: Cal.com API, RetellAI webhooks

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd vantage-ai
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Secret key for NextAuth (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Your application URL (default: `http://localhost:3000`)

4. **Set up the database**

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed the database with demo data
npm run db:seed
```

5. **Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Credentials

After running the seed script:

- **Email**: `admin@demopractice.com`
- **Password**: `demo123`

## Project Structure

```
/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration files
│   └── seed.ts                # Seed data script
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # Auth routes
│   │   ├── (main)/           # Protected routes
│   │   └── api/              # API routes
│   ├── components/           # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Layout components
│   │   ├── patients/         # Patient components
│   │   └── settings/         # Settings components
│   ├── lib/                  # Utilities and helpers
│   │   ├── auth.ts           # NextAuth configuration
│   │   ├── db.ts             # Prisma client
│   │   ├── cal.ts            # Cal.com integration
│   │   ├── retell.ts         # RetellAI integration
│   │   ├── agentActions.ts   # Voice agent actions
│   │   ├── audit.ts          # Audit logging
│   │   └── phi.ts            # PHI redaction
│   └── middleware.ts         # Next.js middleware
├── tests/                    # Test files
└── scripts/                  # Utility scripts
```

## Key Features

### Multi-Tenancy

All data is scoped to a `practiceId`. Every tenant (Practice) has isolated:
- Patients
- Appointments
- Insurance records
- Integrations
- Audit logs

Tenant isolation is enforced at:
- Database level (all queries include `practiceId`)
- API middleware level (extracts `practiceId` from session)
- UI routing level (practice-aware navigation)

### Cal.com Integration

1. **Configure Cal.com API Key**:
   - Go to Settings → Cal.com Integration
   - Enter your Cal.com API key
   - Test the connection

2. **Map Event Types**:
   - Map your visit types (e.g., "Consultation", "Follow-up") to Cal.com event type IDs
   - These mappings are stored per-practice

3. **Book Appointments**:
   - From a patient profile, click "Schedule Appointment"
   - Select visit type and time slot
   - Appointment is created in both Cal.com and local database

### RetellAI Integration

The system includes webhook endpoints for RetellAI voice agents:

1. **Webhook Endpoint**: `/api/retell/webhook`
2. **Supported Actions**:
   - `find_or_create_patient`: Find or create patient by phone number
   - `get_available_slots`: Get available appointment slots
   - `book_appointment`: Book an appointment via Cal.com
   - `cancel_appointment`: Cancel an appointment

**Testing RetellAI Webhook**:

```bash
npm run simulate:retell
```

Or manually:

```bash
curl -X POST http://localhost:3000/api/retell/webhook \
  -H "Content-Type: application/json" \
  -H "X-Practice-Id: demo-practice-1" \
  -d '{
    "event": "tool_calls",
    "call": {
      "call_id": "test-123",
      "phone_number": "+15551001"
    },
    "tool_calls": [{
      "tool_name": "find_or_create_patient",
      "parameters": {
        "phone": "+15551001",
        "name": "John Doe"
      }
    }]
  }'
```

## API Routes

### Patients
- `GET /api/patients` - List patients (with search)
- `POST /api/patients` - Create patient
- `GET /api/patients/[id]` - Get patient details
- `PATCH /api/patients/[id]` - Update patient
- `DELETE /api/patients/[id]` - Soft delete patient

### Appointments
- `GET /api/appointments` - List appointments (with date/status filters)
- `POST /api/appointments` - Create appointment (with Cal.com booking)
- `GET /api/appointments/[id]` - Get appointment details
- `PATCH /api/appointments/[id]` - Update appointment
- `DELETE /api/appointments/[id]` - Cancel appointment
- `GET /api/appointments/slots` - Get available slots from Cal.com

### Insurance
- `POST /api/insurance` - Create insurance policy
- `PATCH /api/insurance/[id]` - Update insurance policy
- `DELETE /api/insurance/[id]` - Delete insurance policy

### Settings
- `GET /api/settings/cal` - Get Cal.com integration settings
- `POST /api/settings/cal` - Update Cal.com integration
- `GET /api/settings/cal/test` - Test Cal.com connection
- `GET /api/settings/cal/event-types` - Get event type mappings
- `POST /api/settings/cal/event-types` - Create event type mapping
- `DELETE /api/settings/cal/event-types/[id]` - Delete event type mapping

### Webhooks
- `POST /api/cal/webhook` - Cal.com webhook endpoint
- `POST /api/retell/webhook` - RetellAI webhook endpoint

## Testing

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Test coverage includes:
- Tenant scoping verification
- Agent actions (find/create patient, booking)
- Webhook handlers

## Happy Path Testing

### 1. Login
1. Navigate to `/login`
2. Use demo credentials: `admin@demopractice.com` / `demo123`
3. Should redirect to dashboard

### 2. View Dashboard
1. Should see today's appointments
2. Should see recent patients
3. Quick actions should be available

### 3. Create a Patient
1. Click "Add Patient" or navigate to `/patients/new`
2. Fill in patient details
3. Submit form
4. Should redirect to patient detail page

### 4. View Patient Details
1. Navigate to `/patients` and click on a patient
2. Should see:
   - Contact information
   - Insurance policies
   - Recent appointments
   - Timeline

### 5. Schedule Appointment
1. From patient detail page, click "Schedule Appointment"
2. Select visit type and time
3. Confirm booking
4. Should create appointment and show confirmation

### 6. Configure Cal.com (Optional)
1. Navigate to `/settings`
2. Enter Cal.com API key
3. Test connection
4. Map visit types to Cal.com event types

### 7. Test RetellAI Webhook (Optional)
1. Use the simulate script: `npm run simulate:retell`
2. Or send POST request to `/api/retell/webhook` with practice ID header

## Security & Compliance

### PHI Protection
- PHI redaction utilities in `src/lib/phi.ts`
- Audit logs automatically redact sensitive data
- Transcripts are redacted before storage

### Tenant Isolation
- All queries are scoped to `practiceId`
- API middleware enforces tenant boundaries
- Cross-tenant access is prevented

### Rate Limiting
- Webhook endpoints have rate limiting (token bucket)
- Configurable limits in `src/lib/middleware.ts`

### Input Validation
- All API inputs validated with Zod schemas
- Type-safe validation in `src/lib/validations.ts`

### Future HIPAA Hardening
- [ ] Encrypt API keys at rest
- [ ] Implement comprehensive audit logging
- [ ] Add data retention policies
- [ ] Implement access controls (RBAC)
- [ ] Add encryption for sensitive fields
- [ ] Implement backup and disaster recovery
- [ ] Add compliance reporting

## Communications Module

### Migrations
Run Prisma migrations and seed demo conversations:

```bash
npm run db:migrate
npm run db:seed
```

### Extension Points
- Replace stub adapters in `src/lib/communications/adapters.ts` with real provider integrations.
- Plug in a real agent in `src/lib/communications/agent.ts`.
- Add a telephony provider via the `voice` channel adapter.
- Add a video provider via the `video` channel adapter.

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Environment Variables for Production

```env
DATABASE_URL=your-production-database-url
NEXTAUTH_SECRET=generate-strong-secret
NEXTAUTH_URL=https://your-domain.com
CALCOM_API_KEY=optional
RETELLAI_WEBHOOK_SECRET=optional
NODE_ENV=production
```

### Database Migrations

In production, run migrations:

```bash
npx prisma migrate deploy
```

## Development

### Database Management

```bash
# Open Prisma Studio
npm run db:studio

# Create new migration
npm run db:migrate

# Reset database (development only)
npx prisma migrate reset
```

### Code Structure

- **Type Safety**: Full TypeScript with strict mode
- **API Routes**: Next.js Route Handlers in `src/app/api`
- **Components**: React Server Components where possible
- **State Management**: React hooks and server state
- **Styling**: Tailwind CSS with shadcn/ui components

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check network/firewall settings

### Authentication Issues
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your domain
- Clear cookies and try again

### Cal.com Integration Issues
- Verify API key is correct
- Check Cal.com API documentation for endpoint changes
- Review webhook signature verification (currently placeholder)

### RetellAI Webhook Issues
- Verify `X-Practice-Id` header is set
- Check webhook payload format
- Review agent action logs

## License

[Your License Here]

## Support

[Your Support Information Here]

