# @vantage/opendental-sdk

Multi-tenant Open Dental REST API integration layer for Vantage CRM.

## Features

- **347 verified API operations** across 105 resource groups
- **Multi-practice tenant isolation** via `PracticeContext` and `PracticeRegistry`
- **Remote-first** with Local/Service cascade fallback
- **PHI-safe structured logging**
- **Rate limit aware** retry with exponential backoff
- **Sync utilities** — pagination, incremental fetch, Signalods watcher
- **Zero business workflow coupling** — pure API exposure

## Quick start

```bash
npm run opendental:build
npm run test:opendental
```

## Documentation

- [Setup Guide](./docs/setup.md)
- [Authentication](./docs/authentication.md)
- [Configuration](./docs/configuration.md)
- [Practice Onboarding](./docs/practice-onboarding.md)
- [Service Reference](./docs/service-reference.md)
- [Endpoint Inventory](./docs/endpoint-inventory.md)
- [Capability Matrix](./docs/capability-matrix.md)

## Architecture

```
packages/opendental-sdk/     ← Pure SDK (no Next.js/Prisma deps)
src/lib/integrations/opendental/  ← CRM bridge (Prisma, encryption, API routes)
```

Completely isolated from the FHIR/EHR integration framework.
