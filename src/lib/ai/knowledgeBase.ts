export interface KnowledgeBaseMatch {
  id: string
  title: string
  url?: string
  snippet?: string
  summary?: string
}

// Placeholder for KB retrieval. Replace with vector search or KB service.
export async function retrieveKnowledgeBaseMatches({
  practiceId,
  query,
  limit = 3,
}: {
  practiceId: string
  query: string
  limit?: number
}): Promise<KnowledgeBaseMatch[]> {
  const { prisma } = await import('@/lib/db')

  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    const recent = await prisma.knowledgeBaseArticle.findMany({
      where: { practiceId, isActive: true },
      select: { id: true, title: true, url: true, body: true, summary: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })
    return recent.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url || undefined,
      snippet: item.summary || item.body.slice(0, 140),
      summary: item.summary || undefined,
    }))
  }

  const faqMatches = await prisma.knowledgeBaseFaq.findMany({
    where: {
      practiceId,
      OR: [
        { question: { contains: normalizedQuery, mode: 'insensitive' } },
        { answer: { contains: normalizedQuery, mode: 'insensitive' } },
      ],
    },
    include: {
      article: { select: { id: true, title: true, url: true } },
    },
    take: limit,
  })

  const chunkMatches = await prisma.knowledgeBaseChunk.findMany({
    where: {
      practiceId,
      content: { contains: normalizedQuery, mode: 'insensitive' },
    },
    include: {
      article: { select: { id: true, title: true, url: true } },
    },
    take: limit,
  })

  const matches = await prisma.knowledgeBaseArticle.findMany({
    where: {
      practiceId,
      isActive: true,
      OR: [
        { title: { contains: normalizedQuery, mode: 'insensitive' } },
        { body: { contains: normalizedQuery, mode: 'insensitive' } },
        { tags: { hasSome: normalizedQuery.split(' ') } },
      ],
    },
    select: { id: true, title: true, url: true, body: true, summary: true },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })

  const combined: KnowledgeBaseMatch[] = []

  faqMatches.forEach((faq) => {
    combined.push({
      id: faq.id,
      title: `FAQ: ${faq.question}`,
      url: faq.article.url || undefined,
      snippet: faq.answer,
      summary: faq.answer,
    })
  })

  chunkMatches.forEach((chunk) => {
    combined.push({
      id: chunk.id,
      title: `KB: ${chunk.article.title}`,
      url: chunk.article.url || undefined,
      snippet: chunk.summary || chunk.content.slice(0, 140),
      summary: chunk.summary || undefined,
    })
  })

  matches.forEach((item) => {
    combined.push({
      id: item.id,
      title: item.title,
      url: item.url || undefined,
      snippet: item.summary || item.body.slice(0, 140),
      summary: item.summary || undefined,
    })
  })

  return combined.slice(0, limit)
}
