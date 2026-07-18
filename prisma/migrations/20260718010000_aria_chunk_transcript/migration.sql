-- AlterTable
ALTER TABLE "scribe_audio_chunks" ADD COLUMN IF NOT EXISTS "transcript" TEXT;
