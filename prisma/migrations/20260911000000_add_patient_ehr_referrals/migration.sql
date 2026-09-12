-- CreateTable
CREATE TABLE "patient_ehr_referrals" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'opendental',
    "externalAttachId" TEXT NOT NULL,
    "externalReferralId" TEXT,
    "referralType" TEXT NOT NULL,
    "status" TEXT,
    "referralDate" TIMESTAMP(3),
    "note" TEXT,
    "specialistName" TEXT,
    "specialistSpecialty" TEXT,
    "specialistPhone" TEXT,
    "specialistTitle" TEXT,
    "isDoctor" BOOLEAN,
    "referringProvNum" INTEGER,
    "procNum" INTEGER,
    "lastPulledAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_ehr_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_ehr_referrals_practiceId_source_externalAttachId_key" ON "patient_ehr_referrals"("practiceId", "source", "externalAttachId");

-- CreateIndex
CREATE INDEX "patient_ehr_referrals_patientId_idx" ON "patient_ehr_referrals"("patientId");

-- CreateIndex
CREATE INDEX "patient_ehr_referrals_practiceId_patientId_idx" ON "patient_ehr_referrals"("practiceId", "patientId");

-- CreateIndex
CREATE INDEX "patient_ehr_referrals_patientId_referralType_idx" ON "patient_ehr_referrals"("patientId", "referralType");

-- AddForeignKey
ALTER TABLE "patient_ehr_referrals" ADD CONSTRAINT "patient_ehr_referrals_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_ehr_referrals" ADD CONSTRAINT "patient_ehr_referrals_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
