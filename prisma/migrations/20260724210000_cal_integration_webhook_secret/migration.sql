-- Per-practice Cal.com webhook signing secret (replaces centralized CALCOM_WEBHOOK_SECRET)
ALTER TABLE "cal_integrations" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;
