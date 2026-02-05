import { Prisma } from '@prisma/client'

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
  fallbackToRecent = false,
}: {
  practiceId: string
  query: string
  limit?: number
  fallbackToRecent?: boolean
}): Promise<KnowledgeBaseMatch[]> {
  const { prisma } = await import('@/lib/db')
  const normalizedQuery = query.trim()
  const stopwords = new Set([
    'the',
    'and',
    'for',
    'with',
    'that',
    'this',
    'what',
    'your',
    'you',
    'can',
    'are',
    'who',
    'how',
    'did',
    'does',
    'from',
    'about',
    'tell',
    'me',
  ])
  const tokens = normalizedQuery
    ? Array.from(
        new Set(
          normalizedQuery
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((token) => token.length >= 3 && !stopwords.has(token))
        )
      ).slice(0, 6)
    : []

  const fetchRecentArticles = async () => {
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

  if (!normalizedQuery) {
    return fetchRecentArticles()
  }

  const extractSnippet = (body: string) => {
    if (!body) return ''
    const lower = body.toLowerCase()
    for (const token of tokens) {
      const index = lower.indexOf(token)
      if (index >= 0) {
        const start = Math.max(0, index - 80)
        const end = Math.min(body.length, index + 160)
        return body.slice(start, end)
      }
    }
    return body.slice(0, 200)
  }

  const faqMatches = await prisma.knowledgeBaseFaq.findMany({
    where: {
      practiceId,
      OR: tokens.length
        ? tokens.flatMap((token) => [
            { question: { contains: token, mode: Prisma.QueryMode.insensitive } },
            { answer: { contains: token, mode: Prisma.QueryMode.insensitive } },
          ])
        : [
            { question: { contains: normalizedQuery, mode: Prisma.QueryMode.insensitive } },
            { answer: { contains: normalizedQuery, mode: Prisma.QueryMode.insensitive } },
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
      OR: tokens.length
        ? tokens.map((token) => ({ content: { contains: token, mode: Prisma.QueryMode.insensitive } }))
        : [{ content: { contains: normalizedQuery, mode: Prisma.QueryMode.insensitive } }],
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
        ...(tokens.length
          ? tokens.flatMap((token) => [
              { title: { contains: token, mode: Prisma.QueryMode.insensitive } },
              { body: { contains: token, mode: Prisma.QueryMode.insensitive } },
            ])
          : [
              { title: { contains: normalizedQuery, mode: Prisma.QueryMode.insensitive } },
              { body: { contains: normalizedQuery, mode: Prisma.QueryMode.insensitive } },
            ]),
        { tags: { hasSome: tokens.length ? tokens : normalizedQuery.split(' ') } },
      ],
    },
    select: { id: true, title: true, url: true, body: true, summary: true },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })

  const combined: KnowledgeBaseMatch[] = []

  matches.forEach((item) => {
    combined.push({
      id: item.id,
      title: item.title,
      url: item.url || undefined,
      snippet: item.summary || extractSnippet(item.body),
      summary: item.summary || undefined,
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

  faqMatches.forEach((faq) => {
    combined.push({
      id: faq.id,
      title: `FAQ: ${faq.question}`,
      url: faq.article.url || undefined,
      snippet: faq.answer,
      summary: faq.answer,
    })
  })

  if (!combined.length && fallbackToRecent) {
    return fetchRecentArticles()
  }

  return combined.slice(0, limit)
}
