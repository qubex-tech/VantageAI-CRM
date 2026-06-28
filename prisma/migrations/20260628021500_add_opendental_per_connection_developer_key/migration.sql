-- Per-connection Open Dental developer key (encrypted). Falls back to the
-- OPEN_DENTAL_DEVELOPER_KEY env var when null, so existing connections keep working.
ALTER TABLE "open_dental_connections" ADD COLUMN IF NOT EXISTS "developerKeyEncrypted" TEXT;
