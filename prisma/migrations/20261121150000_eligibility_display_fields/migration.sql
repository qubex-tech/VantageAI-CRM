-- Practice-selected eligibility benefit fields (Vantage CRM vs EHR chart note)

ALTER TABLE "practice_eligibility_settings"
  ADD COLUMN IF NOT EXISTS "displayFields" JSONB;
