-- AlterTable
ALTER TABLE "practice_settings" ADD COLUMN IF NOT EXISTS "ariaScribeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "scribe_sessions" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "providerUserId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recording',
    "consentAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "transcript" TEXT,
    "soapJson" JSONB,
    "rawModelMeta" JSONB,
    "patientNoteId" TEXT,
    "ehrDocumentReferenceId" TEXT,
    "ehrWritebackStatus" TEXT,
    "ehrWritebackError" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scribe_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "scribe_audio_chunks" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ambient',
    "mimeType" TEXT NOT NULL DEFAULT 'audio/m4a',
    "durationMs" INTEGER,
    "sha256" TEXT,
    "audioData" BYTEA,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scribe_audio_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scribe_sessions_practiceId_idx" ON "scribe_sessions"("practiceId");
CREATE INDEX IF NOT EXISTS "scribe_sessions_patientId_idx" ON "scribe_sessions"("patientId");
CREATE INDEX IF NOT EXISTS "scribe_sessions_providerUserId_idx" ON "scribe_sessions"("providerUserId");
CREATE INDEX IF NOT EXISTS "scribe_sessions_status_idx" ON "scribe_sessions"("status");
CREATE INDEX IF NOT EXISTS "scribe_sessions_startedAt_idx" ON "scribe_sessions"("startedAt");
CREATE INDEX IF NOT EXISTS "scribe_audio_chunks_sessionId_idx" ON "scribe_audio_chunks"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "scribe_audio_chunks_sessionId_seq_key" ON "scribe_audio_chunks"("sessionId", "seq");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "scribe_sessions" ADD CONSTRAINT "scribe_sessions_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "scribe_sessions" ADD CONSTRAINT "scribe_sessions_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "scribe_sessions" ADD CONSTRAINT "scribe_sessions_providerUserId_fkey"
    FOREIGN KEY ("providerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "scribe_audio_chunks" ADD CONSTRAINT "scribe_audio_chunks_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "scribe_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
