-- CreateTable
CREATE TABLE "practices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "preferredContactMethod" TEXT NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_tags" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_timeline_entries" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "planName" TEXT,
    "memberId" TEXT NOT NULL,
    "groupId" TEXT,
    "policyHolderName" TEXT NOT NULL,
    "policyHolderPhone" TEXT,
    "eligibilityStatus" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "fileMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT,
    "status" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "visitType" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "calEventId" TEXT,
    "calBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cal_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "calOrganizationId" TEXT,
    "calTeamId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cal_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cal_event_type_mappings" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "calIntegrationId" TEXT NOT NULL,
    "visitTypeName" TEXT NOT NULL,
    "calEventTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cal_event_type_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_conversations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT,
    "callerPhone" TEXT NOT NULL,
    "retellCallId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "transcript" TEXT,
    "extractedIntent" TEXT,
    "outcome" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_practiceId_idx" ON "users"("practiceId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "patients_practiceId_idx" ON "patients"("practiceId");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_email_idx" ON "patients"("email");

-- CreateIndex
CREATE INDEX "patients_deletedAt_idx" ON "patients"("deletedAt");

-- CreateIndex
CREATE INDEX "patient_tags_patientId_idx" ON "patient_tags"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_tags_patientId_tag_key" ON "patient_tags"("patientId", "tag");

-- CreateIndex
CREATE INDEX "patient_timeline_entries_patientId_createdAt_idx" ON "patient_timeline_entries"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "insurance_policies_practiceId_idx" ON "insurance_policies"("practiceId");

-- CreateIndex
CREATE INDEX "insurance_policies_patientId_idx" ON "insurance_policies"("patientId");

-- CreateIndex
CREATE INDEX "insurance_policies_memberId_idx" ON "insurance_policies"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_calBookingId_key" ON "appointments"("calBookingId");

-- CreateIndex
CREATE INDEX "appointments_practiceId_idx" ON "appointments"("practiceId");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_startTime_idx" ON "appointments"("startTime");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_calBookingId_idx" ON "appointments"("calBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "cal_integrations_practiceId_key" ON "cal_integrations"("practiceId");

-- CreateIndex
CREATE INDEX "cal_integrations_practiceId_idx" ON "cal_integrations"("practiceId");

-- CreateIndex
CREATE INDEX "cal_event_type_mappings_practiceId_idx" ON "cal_event_type_mappings"("practiceId");

-- CreateIndex
CREATE INDEX "cal_event_type_mappings_calEventTypeId_idx" ON "cal_event_type_mappings"("calEventTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "cal_event_type_mappings_practiceId_visitTypeName_key" ON "cal_event_type_mappings"("practiceId", "visitTypeName");

-- CreateIndex
CREATE INDEX "voice_conversations_practiceId_idx" ON "voice_conversations"("practiceId");

-- CreateIndex
CREATE INDEX "voice_conversations_patientId_idx" ON "voice_conversations"("patientId");

-- CreateIndex
CREATE INDEX "voice_conversations_callerPhone_idx" ON "voice_conversations"("callerPhone");

-- CreateIndex
CREATE INDEX "voice_conversations_startedAt_idx" ON "voice_conversations"("startedAt");

-- CreateIndex
CREATE INDEX "audit_logs_practiceId_idx" ON "audit_logs"("practiceId");

-- CreateIndex
CREATE INDEX "audit_logs_practiceId_resourceType_resourceId_idx" ON "audit_logs"("practiceId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_tags" ADD CONSTRAINT "patient_tags_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_timeline_entries" ADD CONSTRAINT "patient_timeline_entries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cal_integrations" ADD CONSTRAINT "cal_integrations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cal_event_type_mappings" ADD CONSTRAINT "cal_event_type_mappings_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cal_event_type_mappings" ADD CONSTRAINT "cal_event_type_mappings_calIntegrationId_fkey" FOREIGN KEY ("calIntegrationId") REFERENCES "cal_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_conversations" ADD CONSTRAINT "voice_conversations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_conversations" ADD CONSTRAINT "voice_conversations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
