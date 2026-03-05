import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const searchParams = req.nextUrl.searchParams
    const callId = searchParams.get('callId')?.trim()
    const limitRaw = Number.parseInt(searchParams.get('limit') || '25', 10)
    const hoursRaw = Number.parseInt(searchParams.get('hours') || '24', 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25
    const hours = Number.isFinite(hoursRaw) ? Math.min(Math.max(hoursRaw, 1), 168) : 24

    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const rows = await prisma.voiceConversation.findMany({
      where: {
        practiceId: user.practiceId,
        retellCallId: callId || undefined,
        startedAt: { gte: since },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        retellCallId: true,
        callerPhone: true,
        startedAt: true,
        metadata: true,
      },
    })

    const escalations = rows
      .map((row) => {
        const metadata = (row.metadata || {}) as Record<string, unknown>
        const attemptedAt = metadata.curogramEscalationAttemptedAt as string | undefined
        const sentAt = metadata.curogramEscalationSentAt as string | undefined
        const status = metadata.curogramEscalationStatus as number | undefined
        const response = metadata.curogramEscalationResponse as string | undefined
        const intentTopic = metadata.curogramEscalationIntentTopic as string | null | undefined
        const requestId = metadata.curogramEscalationRequestId as string | undefined
        const eventType = metadata.curogramEscalationEventType as string | undefined
        const error = metadata.curogramEscalationError as string | undefined
        const callerNumber = metadata.curogramEscalationCallerNumber as string | undefined

        if (!attemptedAt && !sentAt && status === undefined && !error) {
          return null
        }

        return {
          voiceConversationId: row.id,
          retellCallId: row.retellCallId,
          startedAt: row.startedAt,
          callerPhone: row.callerPhone,
          callerNumber,
          eventType,
          requestId,
          attemptedAt: attemptedAt || null,
          sentAt: sentAt || null,
          delivered: Boolean(sentAt),
          status: status ?? null,
          intentTopic: intentTopic ?? null,
          error: error || null,
          responsePreview: response ? response.slice(0, 300) : null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    return NextResponse.json({
      ok: true,
      filters: { callId: callId || null, limit, hours },
      total: escalations.length,
      escalations,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    )
  }
}
