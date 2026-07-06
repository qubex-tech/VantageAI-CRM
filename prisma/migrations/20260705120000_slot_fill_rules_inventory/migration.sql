-- Open slot inventory queue + metadata on open slot events for rules engine
ALTER TABLE "open_slot_events" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE TABLE IF NOT EXISTS "open_slot_inventory" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "visitType" TEXT NOT NULL,
    "providerId" TEXT,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "slotEnd" TIMESTAMP(3) NOT NULL,
    "openSlotSource" TEXT NOT NULL DEFAULT 'availability',
    "sourceAppointmentId" TEXT,
    "origin" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "openSlotEventId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "open_slot_inventory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "open_slot_inventory_practiceId_status_slotStart_idx"
ON "open_slot_inventory"("practiceId", "status", "slotStart");

ALTER TABLE "open_slot_inventory" ADD CONSTRAINT "open_slot_inventory_practiceId_fkey"
FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
