-- Deduplicate any existing rows that share (practiceId, retellCallId), keeping the
-- earliest-created row (tie-broken by id). Required before the unique index below.
DELETE FROM "voice_conversations" a
USING "voice_conversations" b
WHERE a."retellCallId" IS NOT NULL
  AND a."practiceId" = b."practiceId"
  AND a."retellCallId" = b."retellCallId"
  AND (
    a."createdAt" > b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a."id" > b."id")
  );

-- Enforce one conversation row per (practice, Retell call). NULL retellCallId rows
-- remain allowed (Postgres treats NULLs as distinct in unique indexes).
CREATE UNIQUE INDEX IF NOT EXISTS "voice_conversations_practiceId_retellCallId_key"
  ON "voice_conversations" ("practiceId", "retellCallId");
