-- CreateTable
CREATE TABLE "patient_lists" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_list_members" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "matchedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_list_imports" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_list_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_lists_practiceId_idx" ON "patient_lists"("practiceId");

-- CreateIndex
CREATE INDEX "patient_lists_practiceId_name_idx" ON "patient_lists"("practiceId", "name");

-- CreateIndex
CREATE INDEX "patient_list_members_practiceId_patientId_idx" ON "patient_list_members"("practiceId", "patientId");

-- CreateIndex
CREATE INDEX "patient_list_members_listId_idx" ON "patient_list_members"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_list_members_listId_patientId_key" ON "patient_list_members"("listId", "patientId");

-- CreateIndex
CREATE INDEX "patient_list_imports_practiceId_listId_idx" ON "patient_list_imports"("practiceId", "listId");

-- CreateIndex
CREATE INDEX "patient_list_imports_listId_createdAt_idx" ON "patient_list_imports"("listId", "createdAt");

-- AddForeignKey
ALTER TABLE "patient_lists" ADD CONSTRAINT "patient_lists_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_list_members" ADD CONSTRAINT "patient_list_members_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_list_members" ADD CONSTRAINT "patient_list_members_listId_fkey" FOREIGN KEY ("listId") REFERENCES "patient_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_list_members" ADD CONSTRAINT "patient_list_members_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_list_imports" ADD CONSTRAINT "patient_list_imports_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_list_imports" ADD CONSTRAINT "patient_list_imports_listId_fkey" FOREIGN KEY ("listId") REFERENCES "patient_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
