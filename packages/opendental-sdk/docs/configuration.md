# Open Dental Configuration Guide

## API modes

| Mode | Base URL | Use case |
|------|----------|----------|
| **Remote** (default) | `https://api.opendental.com/api/v1` | Cloud CRM, internet-based apps |
| **Service** | `http://{server}:30223/api/v1` | On-prem server with API Service |
| **Local** | `http://localhost:30222/api/v1` | Workstation-local Open Dental |

See [API Modes](https://www.opendental.com/site/apilocal.html).

## Per-practice configuration

Stored in `open_dental_connections`:

| Field | Description |
|-------|-------------|
| `apiMode` | `remote`, `service`, or `local` |
| `baseUrl` | Primary API endpoint |
| `fallbackBaseUrls` | JSON array for cascade fallback |
| `enabledPermissions` | Cached permission tiers from developer portal |

## Cascading fallback

The SDK tries endpoints in order: primary `baseUrl`, then each `fallbackBaseUrls` entry. Recommended cascade for hybrid deployments:

1. Remote (`https://api.opendental.com/api/v1`)
2. Service (`http://192.168.1.10:30223/api/v1`)

## Rate limits

| Permission tier | Throttle |
|-----------------|----------|
| Read All | 1 request / 5 seconds |
| Paid tiers | 1 request / 1 second |
| Enterprise | 500ms (Remote), higher page limits |

Configure via `permissionTier` on `OpenDentalClient` config.

## Pagination

All list endpoints support `Limit` (max 100, 1000 with Enterprise) and `Offset`:

```
GET /patients?Limit=100&Offset=0
```

Use `paginatedFetchAll()` from the SDK for automatic paging.

## API routes (CRM)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/opendental/config` | GET/PUT | Read/update connection settings |
| `/api/integrations/opendental/connect` | POST | Register and validate connection |
| `/api/integrations/opendental/disconnect` | POST | Disable connection |
| `/api/integrations/opendental/status` | GET | Connection status |
| `/api/integrations/opendental/health` | POST | Health probe |
| `/api/integrations/opendental/test` | GET | Smoke test (preferences + clinics) |
