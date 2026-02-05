-- CreateTable
CREATE TABLE "communication_conversation_summaries" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "whatHappened" TEXT NOT NULL,
    "latestPatientAsk" TEXT NOT NULL,
    "actionsTaken" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "lastGeneratedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communication_conversation_summaries_conversationId_key" ON "communication_conversation_summaries"("conversationId");

-- CreateIndex
CREATE INDEX "communication_conversation_summaries_lastGeneratedAt_idx" ON "communication_conversation_summaries"("lastGeneratedAt");

-- AddForeignKey
ALTER TABLE "communication_conversation_summaries" ADD CONSTRAINT "communication_conversation_summaries_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "communication_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
