# Appointment Optimization Agent (MVP)

Automatically detects open appointment slots (from cancellations) and notifies eligible patients who already have **later** appointments—via SMS or voice—with a **patient portal** link to self-reschedule. The CRM does **not** book or modify appointments.

## Setup

1. **Database**

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

2. **Inngest** — ensure `INNGEST_EVENT_KEY` and `/api/inngest` are registered. Functions:
   - `appointment-optimization-open-slot-created` — waves 1–3 with 10-minute waits
   - `appointment-optimization-slot-check` — manual fill checks
   - `slot-fill-rules-eval-daily` — evaluates pending open slot inventory (6:00 AM CT)

3. **Twilio** (SMS) — configure under Settings → API Configuration.

4. **Retell** (optional voice) — `RETELL_FROM_NUMBER` + practice Retell integration.

5. **Settings → Practice Configuration → AI Configuration → Outbound AI Agents**
   - Enable outbound agents (master)
   - Enable **Outbound Appointment Optimization Agent**
   - Select a **published** SMS template from Marketing (dropdown)

6. **Marketing template** — create/publish SMS template named e.g. `Earlier Appointment Available`:

   ```
   Hi {{patient.firstName}} — an earlier appointment just opened with {{appointment.providerName}} on {{appointment.date}} at {{appointment.time}}. You can move your visit here: {{links.portalAppointments}}. This slot is first come, first served.
   ```

7. **Patient opt-in** — Portal → Profile and Preferences → **Earlier appointment offers**.

## Workflow

1. **Open slot ingested** (cancellation, `POST /open-slots`, or future EHR adapter) — source-agnostic
2. **Slot fill rules** (optional): visit type + buffer + look-ahead → `OpenSlotEvent` + Inngest `crm/open-slot.created`
3. Match patients: same provider + visit type, later appointment within look-ahead window, opted in, batch of 5
4. Send SMS/voice with portal link
5. Wait 10 minutes → re-check schedule; if still open, next wave (up to 3 waves)
6. Portal booking fills slot → status **filled**

Configure rules under **Settings → Practice Configuration → AI Configuration → Slot fill rules**. Daily cron at 6:00 AM CT processes pending inventory (`slot-fill-rules-eval-daily`).

## APIs

| Method | Path | Description |
|--------|------|-------------|
| GET/PUT | `/api/settings/outbound-agents` | Agent toggles + slot fill rules |
| POST | `/api/appointment-optimization/open-slots` | Ingest normalized open time slot |
| POST | `/api/appointment-optimization/evaluate` | Run rules on pending inventory (or ingest+evaluate one slot) |
| GET | `/api/appointments/visit-types` | Visit types for rules dropdown |
| GET | `/api/appointment-optimization/slots` | Dashboard data |
| GET | `/api/appointment-optimization/slots/[id]/status` | Re-check fill |
| GET | `/api/appointment-optimization/outreach` | Outreach history |

## Dashboard

`/appointment-optimization` — active slots, waves, patients contacted, fill status.

## Seed (dev)

```bash
npx tsx scripts/seed-appointment-optimization.ts
```

## Events

- `crm/open-slot.created` — starts wave pipeline
- `crm/open-slot.check-filled` — optional status check

## Insurance Verification Agent

Toggle stored in `practice_settings.outboundAgents.insuranceVerificationEnabled`; uses existing `RetellIntegration.insuranceVerificationAgentId` (separate product flow).
