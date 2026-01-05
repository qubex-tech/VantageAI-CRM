-- CreateTable
CREATE TABLE IF NOT EXISTS "healix_conversations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "healix_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "healix_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "healix_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "healix_action_logs" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "userId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "toolName" TEXT,
    "toolArgs" JSONB,
    "toolResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "healix_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_conversations_practiceId_idx" ON "healix_conversations"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_conversations_userId_idx" ON "healix_conversations"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_conversations_updatedAt_idx" ON "healix_conversations"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_messages_conversationId_idx" ON "healix_messages"("conversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_messages_createdAt_idx" ON "healix_messages"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_action_logs_practiceId_idx" ON "healix_action_logs"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_action_logs_userId_idx" ON "healix_action_logs"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_action_logs_conversationId_idx" ON "healix_action_logs"("conversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "healix_action_logs_createdAt_idx" ON "healix_action_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "healix_conversations" ADD CONSTRAINT "healix_conversations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healix_conversations" ADD CONSTRAINT "healix_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healix_messages" ADD CONSTRAINT "healix_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "healix_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healix_action_logs" ADD CONSTRAINT "healix_action_logs_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healix_action_logs" ADD CONSTRAINT "healix_action_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healix_action_logs" ADD CONSTRAINT "healix_action_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "healix_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

