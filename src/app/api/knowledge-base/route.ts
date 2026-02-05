import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { generateKnowledgeBaseSummary } from '@/lib/communications/kbSummaryService'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
  url: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }
    if (!rateLimit(`${user.id}:knowledge-base:list`, 120, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const articles = await prisma.knowledgeBaseArticle.findMany({
      where: { practiceId: user.practiceId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        summary: true,
        url: true,
        tags: true,
        updatedAt: true,
        lastSummarizedAt: true,
      },
    })

    return NextResponse.json({ data: { articles } })
  } catch (error) {
    console.error('Error fetching knowledge base:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch knowledge base' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }
    if (!rateLimit(`${user.id}:knowledge-base:create`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = createSchema.parse(body)

    const article = await prisma.knowledgeBaseArticle.create({
      data: {
        practiceId: user.practiceId,
        title: parsed.title.trim(),
        body: parsed.body.trim(),
        url: parsed.url?.trim() || null,
        tags: parsed.tags ?? [],
      },
      select: {
        id: true,
        title: true,
        summary: true,
        url: true,
        tags: true,
        updatedAt: true,
        lastSummarizedAt: true,
      },
    })

    void generateKnowledgeBaseSummary(article.id)

    return NextResponse.json({ data: { article } }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error creating knowledge base article:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create knowledge base article' },
      { status: 500 }
    )
  }
}
