-- Appointment Optimization Agent
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "earlierAppointmentOptIn" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "practice_settings" ADD COLUMN IF NOT EXISTS "outboundAgents" JSONB;

CREATE TABLE IF NOT EXISTS "open_slot_events" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "providerId" TEXT,
    "appointmentType" TEXT NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "slotEnd" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "locationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL,
    "sourceAppointmentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "wavesSent" INTEGER NOT NULL DEFAULT 0,
    "patientsContacted" INTEGER NOT NULL DEFAULT 0,
    "filledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "open_slot_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "slot_waves" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "openSlotEventId" TEXT NOT NULL,
    "waveNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "patientsTargeted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slot_waves_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "outreach_attempts" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "openSlotEventId" TEXT NOT NULL,
    "slotWaveId" TEXT,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "waveNumber" INTEGER NOT NULL,
    "messageBody" TEXT,
    "externalMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "open_slot_events_practiceId_idempotencyKey_key" ON "open_slot_events"("practiceId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "open_slot_events_practiceId_status_idx" ON "open_slot_events"("practiceId", "status");
CREATE INDEX IF NOT EXISTS "open_slot_events_practiceId_slotStart_idx" ON "open_slot_events"("practiceId", "slotStart");
CREATE INDEX IF NOT EXISTS "open_slot_events_providerId_slotStart_idx" ON "open_slot_events"("providerId", "slotStart");

CREATE UNIQUE INDEX IF NOT EXISTS "slot_waves_openSlotEventId_waveNumber_key" ON "slot_waves"("openSlotEventId", "waveNumber");
CREATE INDEX IF NOT EXISTS "slot_waves_practiceId_status_idx" ON "slot_waves"("practiceId", "status");

CREATE INDEX IF NOT EXISTS "outreach_attempts_practiceId_openSlotEventId_idx" ON "outreach_attempts"("practiceId", "openSlotEventId");
CREATE INDEX IF NOT EXISTS "outreach_attempts_patientId_createdAt_idx" ON "outreach_attempts"("patientId", "createdAt");
CREATE INDEX IF NOT EXISTS "outreach_attempts_openSlotEventId_waveNumber_idx" ON "outreach_attempts"("openSlotEventId", "waveNumber");

CREATE INDEX IF NOT EXISTS "appointments_practiceId_providerId_startTime_idx" ON "appointments"("practiceId", "providerId", "startTime");

ALTER TABLE "open_slot_events" ADD CONSTRAINT "open_slot_events_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slot_waves" ADD CONSTRAINT "slot_waves_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slot_waves" ADD CONSTRAINT "slot_waves_openSlotEventId_fkey" FOREIGN KEY ("openSlotEventId") REFERENCES "open_slot_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_attempts" ADD CONSTRAINT "outreach_attempts_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_attempts" ADD CONSTRAINT "outreach_attempts_openSlotEventId_fkey" FOREIGN KEY ("openSlotEventId") REFERENCES "open_slot_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_attempts" ADD CONSTRAINT "outreach_attempts_slotWaveId_fkey" FOREIGN KEY ("slotWaveId") REFERENCES "slot_waves"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outreach_attempts" ADD CONSTRAINT "outreach_attempts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_attempts" ADD CONSTRAINT "outreach_attempts_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
