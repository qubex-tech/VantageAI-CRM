# EHR Integration Framework

This framework provides a provider-agnostic SMART on FHIR integration layer for multiple EHRs (e.g., eCW, PCC, Epic SMART tenants). Providers are implemented as small plugins with vendor-specific configuration and base URL rules.

## Environment Variables

Required:

```
INTEGRATIONS_TOKEN_ENC_KEY=base64-32-byte-key
APP_BASE_URL=https://your-app-domain.com
```

Optional:

```
SMART_ISSUER_ALLOWLIST=https://ehr.example.com,https://fhir.example.org
SMART_DEFAULT_SCOPES=openid fhirUser profile offline_access patient/Patient.read patient/DocumentReference.read
EHR_JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----
EHR_JWT_KEY_ID=your-key-id
```

If your EHR requires a JWKS URL for `private_key_jwt`, configure:

- JWKS URL: `https://<your-domain>/api/integrations/ehr/jwks`
- `EHR_JWT_PRIVATE_KEY` (PEM-encoded RSA private key)
- Optional `EHR_JWT_KEY_ID` to set the JWKS `kid`

## Provider Plugin Checklist

1. Add provider file under `src/lib/integrations/ehr/providers/`.
2. Define:
   - `id`, `displayName`, `configSchema`, `uiFields`
   - `buildFhirBaseUrl(config)`
   - `defaultScopes({ enableWrite, enablePatientCreate, enableNoteCreate })`
3. Register in `providers/index.ts`.
4. Add provider-specific quirks (optional) in plugin hooks.

## Tenant Settings Structure

Stored in `practice_settings.ehrIntegrations`:

```json
{
  "enabledProviders": ["ecw", "pcc"],
  "providerConfigs": {
    "ecw": { "issuer": "...", "clientId": "...", "clientSecret": "..." },
    "pcc": { "issuer": "...", "clientId": "...", "pccTenantId": "..." }
  },
  "enableWrite": false,
  "enablePatientCreate": false,
  "enableNoteCreate": false,
  "enableBulkExport": false
}
```

## Onboarding Steps (Practice)

1. Go to **Settings → EHR Integrations**
2. Select a provider and enable it
3. Configure issuer + client ID (+ client secret if needed)
4. Save settings
5. Use **Standalone connect** or configure the EHR launch URL

## Troubleshooting Matrix

| Error | Likely Cause | Action |
|------|--------------|--------|
| `invalid_issuer` | Issuer URL not allowed | Update `SMART_ISSUER_ALLOWLIST` |
| `invalid_redirect` | Mismatch in redirect URI | Verify `APP_BASE_URL` and EHR app registration |
| `scope_denied` | Missing scope approval | Enable in provider registration |
| `write_not_supported` | EHR doesn’t allow create | Use read-only or request write scopes |

## PCC Notes

For PointClickCare, `pccTenantId` is required. The base URL is formed as:

```
{fhirBaseUrl}/fhir/R4/{pccTenantId}
```

## Bulk FHIR

Bulk export routes are scaffolded at:

- `/api/integrations/ehr/bulk/start`
- `/api/integrations/ehr/bulk/status`

Implement Inngest polling and NDJSON ingestion when ready.
