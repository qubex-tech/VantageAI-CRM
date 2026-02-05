export interface KnowledgeBaseMatch {
  id: string
  title: string
  url?: string
  snippet?: string
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
      select: { id: true, title: true, url: true, body: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })
    return recent.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url || undefined,
      snippet: item.body.slice(0, 140),
    }))
  }

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
    select: { id: true, title: true, url: true, body: true },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })

  return matches.map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url || undefined,
    snippet: item.body.slice(0, 140),
  }))
}
