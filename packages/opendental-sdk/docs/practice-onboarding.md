# Open Dental Practice Onboarding Guide

## Prerequisites (at the dental office)

1. **eConnector running** — Required for Remote API mode
2. **API enabled** — Setup → Advanced Setup → API → Enabled checkbox
3. **Open Dental version** — Must meet minimum version for each API method used

## Developer portal setup

1. Contact vendor.relations@opendental.com for Developer Portal access
2. Create a Customer API Key for the practice in the Developer Portal
3. Assign permissions needed (Read All minimum; add Comm, Insurance, etc. as required)

## Office-side key assignment

1. In Open Dental: Setup → Advanced Setup → API
2. Click **Add Key** and paste the Customer Key from the Developer Portal
3. Enable the key
4. Verify permissions shown match your integration needs

## Vantage CRM onboarding

1. Configure `OPEN_DENTAL_DEVELOPER_KEY` in environment
2. Run database migration for `open_dental_connections`
3. Call connect API:

```bash
curl -X POST /api/integrations/opendental/connect \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Smith Family Dental",
    "customerKey": "customer-key-from-portal",
    "apiMode": "remote"
  }'
```

4. Verify status: `GET /api/integrations/opendental/status`
5. Optional smoke test: `GET /api/integrations/opendental/test`

## Troubleshooting

| Issue | Check |
|-------|-------|
| 401 Unauthorized | Developer key and customer key correct; key enabled in OD |
| Connection timeout | eConnector running; office internet available |
| 403 / permission errors | Customer key has required permission tier |
| Slow reads | Read All tier throttled to 1 req/5s |

## BAA requirement

API developers should have a Business Associate Agreement (BAA) with their dental practice clients per Open Dental documentation.
