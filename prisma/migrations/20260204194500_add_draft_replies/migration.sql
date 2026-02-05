-- CreateTable
CREATE TABLE "communication_draft_replies" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "draftText" TEXT NOT NULL,
    "citations" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_draft_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communication_draft_replies_conversationId_key" ON "communication_draft_replies"("conversationId");

-- CreateIndex
CREATE INDEX "communication_draft_replies_conversationId_idx" ON "communication_draft_replies"("conversationId");

-- AddForeignKey
ALTER TABLE "communication_draft_replies" ADD CONSTRAINT "communication_draft_replies_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "communication_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
