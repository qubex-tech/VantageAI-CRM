-- Migration: Add Task Management System
-- This migration adds the Task and TaskComment models

-- Create Task table
CREATE TABLE IF NOT EXISTS "tasks" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "assignedTo" TEXT,
    "createdBy" TEXT NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "parentTaskId" TEXT,
    "relatedTaskIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Create TaskComment table
CREATE TABLE IF NOT EXISTS "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "practiceId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- Create indexes for tasks
CREATE INDEX IF NOT EXISTS "tasks_practiceId_idx" ON "tasks"("practiceId");
CREATE INDEX IF NOT EXISTS "tasks_practiceId_assignedTo_idx" ON "tasks"("practiceId", "assignedTo");
CREATE INDEX IF NOT EXISTS "tasks_practiceId_patientId_idx" ON "tasks"("practiceId", "patientId");
CREATE INDEX IF NOT EXISTS "tasks_practiceId_status_idx" ON "tasks"("practiceId", "status");
CREATE INDEX IF NOT EXISTS "tasks_practiceId_dueDate_idx" ON "tasks"("practiceId", "dueDate");
CREATE INDEX IF NOT EXISTS "tasks_practiceId_createdBy_idx" ON "tasks"("practiceId", "createdBy");
CREATE INDEX IF NOT EXISTS "tasks_assignedTo_idx" ON "tasks"("assignedTo");
CREATE INDEX IF NOT EXISTS "tasks_patientId_idx" ON "tasks"("patientId");
CREATE INDEX IF NOT EXISTS "tasks_status_dueDate_idx" ON "tasks"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "tasks_deletedAt_idx" ON "tasks"("deletedAt");

-- Create indexes for task_comments
CREATE INDEX IF NOT EXISTS "task_comments_taskId_idx" ON "task_comments"("taskId");
CREATE INDEX IF NOT EXISTS "task_comments_userId_idx" ON "task_comments"("userId");
CREATE INDEX IF NOT EXISTS "task_comments_practiceId_idx" ON "task_comments"("practiceId");
CREATE INDEX IF NOT EXISTS "task_comments_createdAt_idx" ON "task_comments"("createdAt");

-- Add foreign key constraints
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
