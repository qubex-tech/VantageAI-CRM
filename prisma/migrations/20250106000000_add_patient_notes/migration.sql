-- CreateTable
CREATE TABLE "patient_notes" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "patient_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_notes_patientId_idx" ON "patient_notes"("patientId");

-- CreateIndex
CREATE INDEX "patient_notes_practiceId_idx" ON "patient_notes"("practiceId");

-- CreateIndex
CREATE INDEX "patient_notes_userId_idx" ON "patient_notes"("userId");

-- CreateIndex
CREATE INDEX "patient_notes_type_idx" ON "patient_notes"("type");

-- CreateIndex
CREATE INDEX "patient_notes_createdAt_idx" ON "patient_notes"("createdAt");

-- AddForeignKey
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

