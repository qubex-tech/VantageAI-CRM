-- Insurance verification schema: add new columns and migrate from old structure
-- Step 1: Add new columns (nullable or with default)
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "payerNameRaw" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "groupNumber" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "planType" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "subscriberIsPatient" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "subscriberFirstName" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "subscriberLastName" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "subscriberDob" TIMESTAMP(3);
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "relationshipToPatient" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "bcbsAlphaPrefix" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "bcbsStatePlan" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "rxBin" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "rxPcn" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "rxGroup" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "cardFrontRef" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "cardBackRef" TEXT;

-- Step 2: Backfill from old columns (if they exist)
UPDATE "insurance_policies" SET "payerNameRaw" = "providerName" WHERE "payerNameRaw" IS NULL AND "providerName" IS NOT NULL;
UPDATE "insurance_policies" SET "groupNumber" = "groupId" WHERE "groupNumber" IS NULL AND "groupId" IS NOT NULL;
UPDATE "insurance_policies" SET "payerNameRaw" = COALESCE("payerNameRaw", 'Unknown') WHERE "payerNameRaw" IS NULL;

-- Step 3: Make required new columns NOT NULL
ALTER TABLE "insurance_policies" ALTER COLUMN "payerNameRaw" SET NOT NULL;

-- Step 4: Drop old columns (only if they exist - use DO block for safety)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_policies' AND column_name = 'providerName') THEN
    ALTER TABLE "insurance_policies" DROP COLUMN "providerName";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_policies' AND column_name = 'groupId') THEN
    ALTER TABLE "insurance_policies" DROP COLUMN "groupId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_policies' AND column_name = 'policyHolderName') THEN
    ALTER TABLE "insurance_policies" DROP COLUMN "policyHolderName";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_policies' AND column_name = 'policyHolderPhone') THEN
    ALTER TABLE "insurance_policies" DROP COLUMN "policyHolderPhone";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_policies' AND column_name = 'eligibilityStatus') THEN
    ALTER TABLE "insurance_policies" DROP COLUMN "eligibilityStatus";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_policies' AND column_name = 'lastVerifiedAt') THEN
    ALTER TABLE "insurance_policies" DROP COLUMN "lastVerifiedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_policies' AND column_name = 'fileMetadata') THEN
    ALTER TABLE "insurance_policies" DROP COLUMN "fileMetadata";
  END IF;
END $$;
