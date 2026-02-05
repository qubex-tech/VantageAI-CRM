-- CreateTable
CREATE TABLE "knowledge_base_chunks" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base_faqs" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_base_chunks_practiceId_idx" ON "knowledge_base_chunks"("practiceId");

-- CreateIndex
CREATE INDEX "knowledge_base_chunks_articleId_idx" ON "knowledge_base_chunks"("articleId");

-- CreateIndex
CREATE INDEX "knowledge_base_faqs_practiceId_idx" ON "knowledge_base_faqs"("practiceId");

-- CreateIndex
CREATE INDEX "knowledge_base_faqs_articleId_idx" ON "knowledge_base_faqs"("articleId");

-- AddForeignKey
ALTER TABLE "knowledge_base_chunks" ADD CONSTRAINT "knowledge_base_chunks_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base_chunks" ADD CONSTRAINT "knowledge_base_chunks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base_faqs" ADD CONSTRAINT "knowledge_base_faqs_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base_faqs" ADD CONSTRAINT "knowledge_base_faqs_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
