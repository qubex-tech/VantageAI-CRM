# Open Dental SDK Setup Guide

## Package location

The SDK lives at `packages/opendental-sdk` and is linked into the Vantage CRM app via:

```json
"@vantage/opendental-sdk": "file:packages/opendental-sdk"
```

## Install

```bash
# From repo root
npm install
npm run opendental:build
```

## Environment variables

Add to `.env.local`:

```env
OPEN_DENTAL_DEVELOPER_KEY=your_developer_key
OPEN_DENTAL_DEFAULT_BASE_URL=https://api.opendental.com/api/v1
INTEGRATIONS_TOKEN_ENC_KEY=base64_32_byte_key
OPEN_DENTAL_INTEGRATION_TEST=0
```

## Usage in CRM

```typescript
import { getOpenDentalServices } from '@/lib/integrations/opendental'

const services = await getOpenDentalServices(practiceId)
const patients = await services.patients.list({ Limit: 100, Offset: 0 })
```

## Standalone SDK usage

```typescript
import {
  OpenDentalClient,
  createServiceRegistry,
  toPracticeContext,
} from '@vantage/opendental-sdk'

const context = toPracticeContext({
  practiceId: 'internal-id',
  connectionId: 'conn-id',
  displayName: 'My Dental Practice',
  developerKey: process.env.OPEN_DENTAL_DEVELOPER_KEY!,
  customerKey: 'customer-key-from-portal',
})

const client = new OpenDentalClient({
  credentials: context.credentials,
  baseUrl: context.baseUrl,
  practiceId: context.practiceId,
})

const services = createServiceRegistry(client, context)
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run test:opendental` | Run SDK unit tests |
| `npm run opendental:build` | Compile SDK TypeScript |
| `npx tsx scripts/generate-opendental-capability-matrix.ts` | Regenerate capability matrix |
| `npx tsx scripts/generate-opendental-services.ts` | Regenerate domain services |

## Database migration

```bash
npx prisma migrate deploy
```

Creates the `open_dental_connections` table for per-practice customer keys and connection metadata.
