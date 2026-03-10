-- CreateTable
CREATE TABLE "call_reviews" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_reviews_practiceId_idx" ON "call_reviews"("practiceId");

-- CreateIndex
CREATE INDEX "call_reviews_callId_idx" ON "call_reviews"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "call_reviews_callId_practiceId_userId_key" ON "call_reviews"("callId", "practiceId", "userId");

-- AddForeignKey
ALTER TABLE "call_reviews" ADD CONSTRAINT "call_reviews_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_reviews" ADD CONSTRAINT "call_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
