import { prisma } from '@/lib/db'
import { summarizeKnowledgeBaseArticle } from '@/lib/ai/summarizeKnowledgeBaseArticle'
import { generateKnowledgeBaseFaqs } from '@/lib/ai/generateKnowledgeBaseFaqs'

function chunkContent(body: string, maxLength = 800) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).trim().length > maxLength) {
      if (current.trim()) chunks.push(current.trim())
      current = paragraph
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export async function generateKnowledgeBaseSummary(articleId: string) {
  const article = await prisma.knowledgeBaseArticle.findFirst({
    where: { id: articleId },
    select: { id: true, title: true, body: true, tags: true, summary: true, practiceId: true },
  })

  if (!article) return null

  const summary = await summarizeKnowledgeBaseArticle({
    title: article.title,
    body: article.body,
    tags: article.tags,
  })

  await prisma.knowledgeBaseArticle.update({
    where: { id: article.id },
    data: {
      summary,
      lastSummarizedAt: new Date(),
    },
  })

  const chunks = chunkContent(article.body)
  await prisma.knowledgeBaseChunk.deleteMany({ where: { articleId: article.id } })
  if (chunks.length) {
    await prisma.knowledgeBaseChunk.createMany({
      data: chunks.map((chunk) => ({
        practiceId: article.practiceId,
        articleId: article.id,
        content: chunk,
        summary: chunk.slice(0, 200),
      })),
    })
  }

  const faqs = await generateKnowledgeBaseFaqs({
    title: article.title,
    body: article.body,
    summary,
    tags: article.tags,
  })

  await prisma.knowledgeBaseFaq.deleteMany({ where: { articleId: article.id } })
  if (faqs.length) {
    await prisma.knowledgeBaseFaq.createMany({
      data: faqs.map((faq) => ({
        practiceId: article.practiceId,
        articleId: article.id,
        question: faq.question,
        answer: faq.answer,
      })),
    })
  }

  return prisma.knowledgeBaseArticle.findFirst({
    where: { id: article.id },
    select: {
      id: true,
      title: true,
      summary: true,
      lastSummarizedAt: true,
    },
  })
}
