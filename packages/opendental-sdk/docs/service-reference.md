# Open Dental Service Reference

## Service registry

All domain services are accessed via `createServiceRegistry(client, context)`:

```typescript
const services = createServiceRegistry(client, context)

// 105 resource groups available, including:
services.patients.list({ Limit: 100 })
services.appointments.getSlots({ date: '2026-06-10' })
services.providers.list()
services.clinics.list()
services.claims.list({ PatNum: 15 })
services.documents.upload(body)
services.queries.shortQuery(body)
```

## Core services

| Service | Resource path | Key operations |
|---------|---------------|----------------|
| `patients` | `/patients` | list, get, getSimple, create, update |
| `appointments` | `/appointments` | list, get, getSlots, create, update, confirm, break |
| `providers` | `/providers` | list, get, create, update |
| `clinics` | `/clinics` | list, update |
| `operatories` | `/operatories` | list, get |
| `schedules` | `/schedules` | list, get |
| `definitions` | `/definitions` | list, create |
| `preferences` | `/preferences` | list |
| `procedureLogs` | `/procedurelogs` | list, create, update, delete |
| `claims` | `/claims` | list, create, update, updateStatus |
| `payments` | `/payments` | list, create, update |
| `documents` | `/documents` | list, upload, downloadSftp |
| `signalods` | `/signalods` | list (change notifications) |
| `queries` | `/queries` | post, shortQuery |

## Full inventory

See [capability-matrix.md](./capability-matrix.md) for all 347 verified operations across 105 resources.

## Sync helpers

```typescript
import { paginatedFetchAll, watchSignalods, getSyncCapabilities } from '@vantage/opendental-sdk'

// Fetch all pages
const allPatients = await paginatedFetchAll(
  (params) => services.patients.list(params) as Promise<Record<string, unknown>[]>
)

// Change notifications
const changes = await watchSignalods(services.signalods, { since: '2026-06-01 00:00:00' })

// Check sync support
const caps = getSyncCapabilities('Patients')
// { uniqueId, search, create, update, delete, bulkRead, incrementalRead, ... }
```

## Typed models

Core types exported from `@vantage/opendental-sdk`:

- `Patient`, `PatientSimple`, `CreatePatientRequest`
- `Appointment`, `Provider`, `Clinic`, `Operatory`, `Schedule`, `Definition`

All Open Dental fields use PascalCase per API specification.
