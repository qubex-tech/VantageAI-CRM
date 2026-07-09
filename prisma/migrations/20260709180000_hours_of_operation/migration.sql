-- Practice hours of operation + lunch for slot-fill availability
ALTER TABLE "practice_settings" ADD COLUMN IF NOT EXISTS "hoursOfOperation" JSONB;
