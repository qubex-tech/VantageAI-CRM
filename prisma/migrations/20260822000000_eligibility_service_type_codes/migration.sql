ALTER TABLE "practice_eligibility_settings"
  ADD COLUMN IF NOT EXISTS "defaultServiceTypeCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "practice_eligibility_settings"
SET "defaultServiceTypeCodes" = ARRAY["defaultServiceType"]
WHERE COALESCE(array_length("defaultServiceTypeCodes", 1), 0) = 0
  AND "defaultServiceType" IS NOT NULL
  AND TRIM("defaultServiceType") <> '';
