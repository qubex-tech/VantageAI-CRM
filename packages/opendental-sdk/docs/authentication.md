# Open Dental Authentication Guide

## Overview

Open Dental REST API uses a dual-key authentication scheme:

```
Authorization: ODFHIR {DeveloperKey}/{CustomerKey}
```

## Keys

| Key | Scope | Storage |
|-----|-------|---------|
| **Developer Key** | Application-wide | `OPEN_DENTAL_DEVELOPER_KEY` env var |
| **Customer Key** | Per practice | Encrypted in `open_dental_connections.customerKeyEncrypted` |

Obtain a Developer Key by contacting vendor.relations@opendental.com per [API Setup](https://www.opendental.com/site/apisetup.html).

## Test credentials

For development against Open Dental's test database:

```
Authorization: ODFHIR NFF6i0KrXrxDkZHt/VzkmZEaUWOjnQX2z
```

These are exported as `TEST_CREDENTIALS` from the SDK.

## Validation

The SDK validates connections by calling `GET /clinics` or `GET /preferences`:

```typescript
import { validateConnection } from '@vantage/opendental-sdk'

const result = await validateConnection(client)
// { valid: true, message: 'Connection validated successfully' }
```

## CRM connection flow

1. Admin POSTs to `/api/integrations/opendental/connect` with `customerKey` and `displayName`
2. Bridge encrypts customer key and stores in `OpenDentalConnection`
3. Connection is validated against Open Dental remote API
4. Status updated to `connected` or `error`

## Security notes

- Never log customer keys or API response bodies containing PHI
- Developer key is shared; customer key provides tenant isolation at Open Dental
- Each CRM `practiceId` maps to exactly one Open Dental customer key
