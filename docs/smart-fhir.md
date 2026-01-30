# SMART on FHIR Integration (eClinicalWorks + Vantage AI)

This module provides a production-ready SMART on FHIR integration for the Vantage AI CRM. It supports EHR-launched and standalone flows, OAuth2 Authorization Code + PKCE, token refresh, and safe draft note creation using `DocumentReference`.

## Features

- SMART on FHIR Authorization Code + PKCE (EHR launch + standalone)
- Token storage with AES-256-GCM encryption
- Auto refresh on 401 / expiry
- Capability statement parsing and write gating
- Draft note creation (DocumentReference + optional Binary)
- Multi-tenant isolation and audit logging

## Required Environment Variables

Set these in your environment (e.g., `.env.local`):

```
INTEGRATIONS_TOKEN_ENC_KEY=base64-32-byte-key
APP_BASE_URL=https://your-app-domain.com
SMART_DEFAULT_SCOPES=openid fhirUser profile offline_access patient/Patient.read patient/DocumentReference.read
SMART_ENABLE_WRITE=false
```

Optional:

```
SMART_ISSUER_ALLOWLIST=https://fhir.example.com,https://ehr.example.org
LOG_REDACTION_ENABLED=true
```

### Generating `INTEGRATIONS_TOKEN_ENC_KEY`

Use a 32-byte base64 key:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Tenant Settings

Stored in `practice_settings.smartFhir`:

```json
{
  "enabled": true,
  "issuer": "https://ehr.example.com/fhir",
  "fhirBaseUrl": "https://ehr.example.com/fhir",
  "clientId": "your-client-id",
  "enableWrite": false,
  "enablePatientCreate": false,
  "enableNoteCreate": false
}
```

Write scopes are added only when:

1. `SMART_ENABLE_WRITE=true`
2. Tenant `enableWrite=true`
3. Specific feature flag is enabled (`enableNoteCreate` / `enablePatientCreate`)

## Endpoints

- `GET /api/integrations/smart/launch` – SMART EHR launch (requires `iss` + `launch`)
- `GET /api/integrations/smart/login` – standalone connect
- `GET /api/integrations/smart/callback` – OAuth callback
- `POST /api/integrations/smart/disconnect` – revoke + delete tokens
- `GET /api/integrations/smart/status` – connection status + optional capabilities
- `GET /api/integrations/smart/test/patient` – test patient read
- `POST /api/integrations/smart/test/note` – test draft note creation

## How to Register the App with an EHR (Generic SMART Steps)

1. Register a SMART app in the EHR vendor portal.
2. Configure redirect URI:
   - `https://your-app-domain.com/api/integrations/smart/callback`
3. Configure launch URI:
   - `https://your-app-domain.com/api/integrations/smart/launch`
4. Capture the client ID from the EHR portal and save it in settings.
5. Provide the issuer base URL (FHIR base) in settings.

## Draft Note Workflow (DocumentReference)

Notes are always drafted, never finalized:

- `DocumentReference.status` uses `current` with title `DRAFT - AI Generated Note`
- `DocumentReference.description` adds provenance
- Optional Binary creation if required by the EHR

## Capability Gating

Write operations are only attempted when:

- Tenant feature flags enable write
- EHR capability statement supports the write interaction

If not supported, the API returns `409` with code `WRITE_NOT_SUPPORTED`.

## Troubleshooting

**Discovery fails**
- Ensure the issuer URL is correct and SMART config is enabled.
- The module tries `.well-known/smart-configuration`, then `/metadata`.

**Token refresh failures**
- Connection status will mark as expired.
- Reconnect from the settings page.

**Write not supported**
- The EHR may not allow `DocumentReference` or `Patient` create.
- Request additional scopes or enable write permissions in the EHR app registry.

## Migration

Run migrations after pulling:

```
npx prisma migrate dev
```

Or apply SQL from:

`prisma/migrations/20260130090000_add_smart_fhir_integration/migration.sql`
