import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/middleware'
import { ariaDisabledResponse, isAriaScribeEnabled } from '@/lib/aria/enabled'
import { ingestPebbleDictationToSession } from '@/lib/aria/pebbleIngest'
import { resolvePebbleAriaSession } from '@/lib/aria/pebbleActiveSession'
import {
  extractPebbleWebhookToken,
  matchPebbleWebhookPractice,
} from '@/lib/pebble-webhook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Pebble Index 01 webhook ingest → Aria dictation chunk.
 *
 * Configure in Pebble app → Index → Webhook:
 *   URL:    https://<host>/api/pebble/webhook
 *   Header: Authorization: Bearer <provider webhook secret>
 *   Send:   Both (audio + transcription) recommended
 *   Trigger: Double click & hold (recommended for Aria)
 *
 * Docs: https://github.com/coredevices/mobileapp/.../INDEX_WEBHOOK_API.md
 */
export async function POST(req: NextRequest) {
  const requestId = `pebble-webhook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(`pebble-webhook:${ip}`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const token = extractPebbleWebhookToken(req.headers)
    if (!token) {
      return NextResponse.json({ error: 'Missing webhook token' }, { status: 401 })
    }

    const integrations = await prisma.pebbleIntegration.findMany({
      where: {
        isActive: true,
        webhookSecret: { not: null },
      },
      select: {
        id: true,
        practiceId: true,
        webhookSecret: true,
        providerUserId: true,
        activeSessionId: true,
      },
    })

    const match = matchPebbleWebhookPractice(
      token,
      integrations
        .filter(
          (row): row is typeof row & { webhookSecret: string; providerUserId: string } =>
            Boolean(row.webhookSecret) && Boolean(row.providerUserId)
        )
        .map((row) => ({
          id: row.id,
          practiceId: row.practiceId,
          webhookSecret: row.webhookSecret,
          providerUserId: row.providerUserId,
          activeSessionId: row.activeSessionId,
        }))
    )

    if (!match) {
      console.warn(`[${requestId}] Unauthorized pebble webhook`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isAriaScribeEnabled(match.practiceId))) {
      return NextResponse.json(ariaDisabledResponse(), { status: 403 })
    }

    const form = await req.formData()
    const audioEntry = form.get('audio')
    const transcriptionRaw = form.get('transcription')
    const recordedAtRaw = form.get('recordedAt')
    const clientRaw = form.get('client')

    const pebbleTranscription =
      typeof transcriptionRaw === 'string' && transcriptionRaw.trim()
        ? transcriptionRaw.trim()
        : null

    let audio: Buffer | null = null
    let mimeType = 'audio/mp4'
    if (audioEntry instanceof File && audioEntry.size > 0) {
      audio = Buffer.from(await audioEntry.arrayBuffer())
      mimeType = audioEntry.type || 'audio/mp4'
    }

    if (!audio && !pebbleTranscription) {
      return NextResponse.json(
        { error: 'audio or transcription is required' },
        { status: 400 }
      )
    }

    const recordedAtMs =
      recordedAtRaw != null && String(recordedAtRaw).length
        ? parseInt(String(recordedAtRaw), 10)
        : null
    const trigger = req.headers.get('x-index-trigger')
    const client = typeof clientRaw === 'string' ? clientRaw : 'ring'

    const session = await resolvePebbleAriaSession({
      practiceId: match.practiceId,
      providerUserId: match.providerUserId,
      activeSessionId: match.activeSessionId,
    })

    if (!session) {
      return NextResponse.json(
        {
          error: 'No active Aria session',
          code: 'NO_ACTIVE_ARIA_SESSION',
          hint: 'Open VantageAI mobile, start an Aria visit for the patient, then dictate on the ring.',
        },
        { status: 409 }
      )
    }

    const result = await ingestPebbleDictationToSession({
      sessionId: session.id,
      practiceId: match.practiceId,
      audio,
      mimeType,
      pebbleTranscription,
      recordedAtMs: Number.isFinite(recordedAtMs) ? recordedAtMs : null,
      trigger,
      client,
    })

    console.log(
      `[${requestId}] ingested pebble dictation session=${session.id} seq=${result.seq} asr=${result.asrSource}`
    )

    return NextResponse.json(
      {
        ok: true,
        sessionId: session.id,
        regenerated: result.regenerated,
        chunk: {
          id: result.chunkId,
          seq: result.seq,
          kind: 'dictation',
          transcript: result.transcript,
          asrSource: result.asrSource,
        },
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error(`[${requestId}] pebble webhook error`, err)
    if (message === 'Session is closed' || message === 'Session not found') {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('too large') || message.includes('required')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
