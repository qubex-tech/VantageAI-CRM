ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "externalMrn" TEXT;
CREATE INDEX IF NOT EXISTS "patients_externalMrn_idx" ON "patients"("externalMrn");
