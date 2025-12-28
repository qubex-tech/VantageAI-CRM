# Cal.com Integration Status

## ✅ Integration Complete

The Cal.com integration has been successfully configured and tested.

## API Key
- **Key**: `cal_live_3bb83c6e7571c1f53904014c3f097327`
- **API Version**: v2
- **Status**: ✅ Working

## Event Types Found

Your Cal.com account has the following event types:

1. **15 Min Meeting**
   - ID: `40949`
   - Duration: 15 minutes

2. **30 Min Meeting**
   - ID: `40950`
   - Duration: 30 minutes

3. **Secret Meeting**
   - ID: `40951`
   - Duration: 15 minutes

4. **Established Patient Booking with Dr. Nasir**
   - ID: `1534773`
   - Duration: 30 minutes

## Next Steps

### 1. Configure in App Settings
1. Go to **Settings** page in the app
2. Enter the API key: `cal_live_3bb83c6e7571c1f53904014c3f097327`
3. Click **"Test Connection"** (should succeed)
4. Click **"Save Settings"**

### 2. Map Event Types to Visit Types
After saving the API key, you can map your Cal.com event types to visit types:
- Go to Settings → Cal.com Integration
- For each event type, create a mapping:
  - Select the Cal.com event type (by ID)
  - Set a visit type name (e.g., "Consultation", "Follow-up", "Initial Visit")

### 3. Test Booking Creation
To test the full integration:
1. Create a patient (or use existing)
2. Go to patient detail page
3. Click "Schedule Appointment"
4. Select a visit type (that's mapped to a Cal.com event type)
5. Select a date/time
6. Confirm booking

The appointment should be:
- Created in Cal.com
- Stored locally in the database
- Linked via `calBookingId`
- Synced via webhooks

## API Endpoints Implemented

- ✅ `GET /api/settings/cal` - Get integration settings
- ✅ `POST /api/settings/cal` - Save API key and test connection
- ✅ `GET /api/settings/cal/test` - Test connection
- ✅ `GET /api/settings/cal/event-types` - Get available event types
- ✅ `POST /api/settings/cal/event-types` - Create event type mapping
- ✅ `POST /api/appointments` - Create booking (with Cal.com integration)
- ✅ `GET /api/appointments/slots` - Get available time slots
- ✅ `POST /api/cal/webhook` - Handle Cal.com webhooks

## Testing

Run the test script:
```bash
npx tsx scripts/test-cal-integration.ts
```

This will:
- Test API connection
- List all available event types
- Verify the API key works correctly

## Notes

- The integration uses Cal.com API v2 (recommended version)
- API keys are stored in the database (not encrypted - should be encrypted in production)
- Webhook signature verification is implemented but requires `CALCOM_WEBHOOK_SECRET` env variable
- All bookings are synced between Cal.com and local database
