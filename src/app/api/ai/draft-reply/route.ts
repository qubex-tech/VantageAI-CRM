import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, rateLimit } from '@/lib/middleware'
import { buildDraftReply, rewriteDraft } from '@/lib/communications/draftService'

export const dynamic = 'force-dynamic'

const schema = z.object({
  conversation_id: z.string().uuid(),
  rewrite_mode: z.enum(['shorten', 'empathetic', 'direct', 'spanish']).optional(),
  message_limit: z.number().int().min(5).max(50).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required for this operation' }, { status: 400 })
    }

    if (!rateLimit(`${user.id}:ai:draft-reply`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = schema.parse(body)
    const practiceId = user.practiceId

    if (parsed.rewrite_mode) {
      const rewritten = await rewriteDraft({
        practiceId,
        conversationId: parsed.conversation_id,
        actorUserId: user.id,
        mode: parsed.rewrite_mode,
      })

      if (!rewritten) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      return NextResponse.json({
        data: {
          draft_text: rewritten.draftText,
          citations: rewritten.citations,
          confidence: rewritten.confidence,
          sources: rewritten.sources,
        },
      })
    }

    const response = await buildDraftReply({
      practiceId,
      conversationId: parsed.conversation_id,
      actorUserId: user.id,
      messageLimit: parsed.message_limit,
    })

    if (response.error === 'clinical') {
      return NextResponse.json(
        { error: 'This message requires clinical review', code: 'clinical_review' },
        { status: 422 }
      )
    }

    if (!response.result) {
      return NextResponse.json({ error: 'Draft unavailable' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        draft_text: response.result.draftText,
        citations: response.result.citations,
        confidence: response.result.confidence,
        sources: response.result.sources,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error generating draft reply:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate draft reply' },
      { status: 500 }
    )
  }
}
