-- Per-practice clinical system selection (FHIR vs Open Dental, etc.)
ALTER TABLE "practice_settings" ADD COLUMN IF NOT EXISTS "clinicalIntegrations" JSONB;
