# RetellAI Real-Time Call Consumption (No CRM Login)

**Parent:** [Vantage AI](https://www.notion.so/VantageAI-2d77690ceb4f80febcf4e5e5ca11a09d)

---

## Overview

This feature consumes RetellAI call data in real time without requiring any user to be logged into the CRM. When a call ends (or is analyzed), the system automatically fetches or receives the full call payload, extracts patient information from post-call analysis, and creates or updates the patient record and voice conversation in the CRM.

---

## How It Works

1. **Webhook** – RetellAI sends `call_started`, `call_ended`, and `call_analyzed` events to our endpoint.
2. **Endpoint** – `POST https://app.getvantage.tech/api/retell/webhook?practiceId=<practice-id>` (practiceId can also be in header or `RETELLAI_DEFAULT_PRACTICE_ID`).
3. **Event emission** – On `call_ended` or `call_analyzed`, the webhook handler emits an Inngest event `retell/call.ended` with `practiceId`, `callId`, and (for `call_analyzed`) the full call payload.
4. **Inngest function** – `process-retell-call-ended` runs: for `call_analyzed` it uses the payload directly; for `call_ended` it waits 30s then fetches the call via Retell API.
5. **Processing** – `processRetellCallData` runs: extracts data (e.g. `patient_name`, `call_reason` from `call_analysis.custom_analysis_data`), finds or creates the patient, and updates `VoiceConversation`.

---

## Requirements

### Configuration

| Requirement | Description |
|-------------|-------------|
| **Webhook URL** | RetellAI must be configured with `https://app.getvantage.tech/api/retell/webhook?practiceId=<practice-id>`. |
| **Practice ID** | Must be a valid practice ID from the CRM (query param, header `X-Practice-Id`, or env `RETELLAI_DEFAULT_PRACTICE_ID`). |
| **Inngest** | Inngest app Serve URL must be `https://app.getvantage.tech/api/inngest` so all 3 functions (including `process-retell-call-ended`) are registered. |
| **RetellAI integration** | The practice must have RetellAI integration configured in Settings (API key) for the optional API fetch path (`call_ended` without `call_analyzed` payload). |

### Event Types (RetellAI)

- **call_started** – Basic call info; we create/update `VoiceConversation` if needed.
- **call_ended** – Full call object *except* `call_analysis`; we emit Inngest and optionally fetch full call via API after 30s.
- **call_analyzed** – Full call object *including* `call_analysis`; we emit Inngest with full payload (no API fetch, no delay).

### Data Used

- **Transcript** – `call.transcript` (per RetellAI docs).
- **Caller** – `call.from_number` / `call.to_number`.
- **Patient extraction** – `call_analysis.custom_analysis_data` (e.g. `patient_name`, `call_reason`, `detailed_call_summary`). Used to create/update patient and conversation.

---

## Requirements Summary (Checklist)

- [ ] RetellAI webhook URL set to production URL with correct `practiceId`.
- [ ] Inngest Serve URL set to `https://app.getvantage.tech/api/inngest` (not a Vercel deployment URL).
- [ ] Inngest sync shows 3 functions; `retell/call.ended` lists "Process RetellAI Call Ended".
- [ ] Practice has RetellAI integration configured if using `call_ended`-only path (API fetch).
- [ ] No duplicate function registration (single codebase/deployment for Inngest sync).

---

## Troubleshooting

| Symptom | Check |
|--------|--------|
| Patient not created until user opens Calls tab | Inngest function not registered or running; confirm Serve URL and re-sync. |
| Webhook 400 | Missing `practiceId`; add to URL, header, or `RETELLAI_DEFAULT_PRACTICE_ID`. |
| Only 2 functions in Inngest | Inngest syncing from wrong URL; switch to `https://app.getvantage.tech/api/inngest`. |
| Events received but no function triggered | Same as above; ensure `process-retell-call-ended` is registered for `retell/call.ended`. |

---

## References

- RetellAI Webhook Overview: https://docs.retellai.com/features/webhook-overview
- Inngest endpoint (production): `https://app.getvantage.tech/api/inngest`
- Code: `src/app/api/retell/webhook/route.ts`, `src/lib/retell.ts`, `src/inngest/functions/process-retell-call-ended.ts`
