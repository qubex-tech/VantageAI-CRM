-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "schema" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_requests" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_requests_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "form_submissions" ADD COLUMN "formTemplateId" TEXT;
ALTER TABLE "form_submissions" ADD COLUMN "formRequestId" TEXT;

-- CreateIndex
CREATE INDEX "form_templates_practiceId_idx" ON "form_templates"("practiceId");

-- CreateIndex
CREATE INDEX "form_templates_practiceId_status_idx" ON "form_templates"("practiceId", "status");

-- CreateIndex
CREATE INDEX "form_templates_practiceId_category_idx" ON "form_templates"("practiceId", "category");

-- CreateIndex
CREATE INDEX "form_templates_isSystem_idx" ON "form_templates"("isSystem");

-- CreateIndex
CREATE INDEX "form_requests_practiceId_idx" ON "form_requests"("practiceId");

-- CreateIndex
CREATE INDEX "form_requests_practiceId_patientId_idx" ON "form_requests"("practiceId", "patientId");

-- CreateIndex
CREATE INDEX "form_requests_practiceId_status_idx" ON "form_requests"("practiceId", "status");

-- CreateIndex
CREATE INDEX "form_requests_formTemplateId_idx" ON "form_requests"("formTemplateId");

-- CreateIndex
CREATE INDEX "form_submissions_formTemplateId_idx" ON "form_submissions"("formTemplateId");

-- CreateIndex
CREATE INDEX "form_submissions_formRequestId_idx" ON "form_submissions"("formRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "form_submissions_formRequestId_key" ON "form_submissions"("formRequestId");

-- AddForeignKey
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "form_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_formRequestId_fkey" FOREIGN KEY ("formRequestId") REFERENCES "form_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
