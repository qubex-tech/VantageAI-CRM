-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_conversations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "subject" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_messages" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'queued',
    "metadata" JSONB,
    "intent" TEXT,
    "intentConfidence" DOUBLE PRECISION,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_assignments" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "assignedTeamId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_attachments" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_triggers" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "conditionsJson" JSONB NOT NULL,
    "actionsJson" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_practiceId_idx" ON "teams"("practiceId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_practiceId_name_key" ON "teams"("practiceId", "name");

-- CreateIndex
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");

-- CreateIndex
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- CreateIndex
CREATE INDEX "communication_conversations_practiceId_idx" ON "communication_conversations"("practiceId");

-- CreateIndex
CREATE INDEX "communication_conversations_practiceId_status_idx" ON "communication_conversations"("practiceId", "status");

-- CreateIndex
CREATE INDEX "communication_conversations_practiceId_channel_idx" ON "communication_conversations"("practiceId", "channel");

-- CreateIndex
CREATE INDEX "communication_conversations_practiceId_lastMessageAt_idx" ON "communication_conversations"("practiceId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "communication_conversations_patientId_idx" ON "communication_conversations"("patientId");

-- CreateIndex
CREATE INDEX "communication_messages_practiceId_idx" ON "communication_messages"("practiceId");

-- CreateIndex
CREATE INDEX "communication_messages_conversationId_idx" ON "communication_messages"("conversationId");

-- CreateIndex
CREATE INDEX "communication_messages_patientId_idx" ON "communication_messages"("patientId");

-- CreateIndex
CREATE INDEX "communication_messages_authorUserId_idx" ON "communication_messages"("authorUserId");

-- CreateIndex
CREATE INDEX "communication_messages_createdAt_idx" ON "communication_messages"("createdAt");

-- CreateIndex
CREATE INDEX "communication_messages_deliveryStatus_idx" ON "communication_messages"("deliveryStatus");

-- CreateIndex
CREATE INDEX "communication_assignments_practiceId_idx" ON "communication_assignments"("practiceId");

-- CreateIndex
CREATE INDEX "communication_assignments_conversationId_idx" ON "communication_assignments"("conversationId");

-- CreateIndex
CREATE INDEX "communication_assignments_assignedUserId_idx" ON "communication_assignments"("assignedUserId");

-- CreateIndex
CREATE INDEX "communication_assignments_assignedTeamId_idx" ON "communication_assignments"("assignedTeamId");

-- CreateIndex
CREATE INDEX "communication_assignments_status_idx" ON "communication_assignments"("status");

-- CreateIndex
CREATE INDEX "communication_attachments_practiceId_idx" ON "communication_attachments"("practiceId");

-- CreateIndex
CREATE INDEX "communication_attachments_messageId_idx" ON "communication_attachments"("messageId");

-- CreateIndex
CREATE INDEX "communication_triggers_practiceId_idx" ON "communication_triggers"("practiceId");

-- CreateIndex
CREATE INDEX "communication_triggers_practiceId_eventType_idx" ON "communication_triggers"("practiceId", "eventType");

-- CreateIndex
CREATE INDEX "communication_triggers_enabled_idx" ON "communication_triggers"("enabled");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_conversations" ADD CONSTRAINT "communication_conversations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "communication_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_assignments" ADD CONSTRAINT "communication_assignments_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_assignments" ADD CONSTRAINT "communication_assignments_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "communication_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_assignments" ADD CONSTRAINT "communication_assignments_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_assignments" ADD CONSTRAINT "communication_assignments_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_assignments" ADD CONSTRAINT "communication_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_attachments" ADD CONSTRAINT "communication_attachments_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_attachments" ADD CONSTRAINT "communication_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "communication_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_triggers" ADD CONSTRAINT "communication_triggers_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
