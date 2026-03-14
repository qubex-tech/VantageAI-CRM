import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveEhrPractice } from '@/lib/integrations/ehr/server'
import { prisma } from '@/lib/db'
import { getRetellClient } from '@/lib/retell-api'
import { processRetellCallData } from '@/lib/process-call-data'
import { writeBackRetellCallToEhr } from '@/lib/integrations/ehr/writeback'

const bodySchema = z.object({
  callId: z.string().min(1),
  practiceId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
    const backendApiKey = process.env.EHR_BACKEND_API_KEY
    const isApiKeyAuth =
      backendApiKey &&
      apiKey &&
      (apiKey === backendApiKey || apiKey === `Bearer ${backendApiKey}`)
    if (isApiKeyAuth && !parsed.data.practiceId) {
      return NextResponse.json({ error: 'practiceId is required for API key auth' }, { status: 400 })
    }

    const authContext = isApiKeyAuth
      ? { practiceId: parsed.data.practiceId!, user: { id: 'system' } }
      : await resolveEhrPractice(parsed.data.practiceId)
    const { practiceId } = authContext

    const retellClient = await getRetellClient(practiceId)
    const fullCall = await retellClient.getCall(parsed.data.callId)

    const { patientId, extractedData } = await processRetellCallData(practiceId, fullCall, null)
    const result = await writeBackRetellCallToEhr({
      practiceId,
      patientId,
      call: fullCall,
      extractedData,
    })

    let writebackMeta: Record<string, unknown> | undefined
    if (isApiKeyAuth) {
      const conversation = await prisma.voiceConversation.findFirst({
        where: { practiceId, retellCallId: parsed.data.callId },
        select: { metadata: true },
      })
      const metadata =
        conversation?.metadata && typeof conversation.metadata === 'object'
          ? (conversation.metadata as Record<string, unknown>)
          : {}
      writebackMeta = {
        ehrWritebackStatus: metadata.ehrWritebackStatus,
        ehrWritebackError: metadata.ehrWritebackError,
        ehrWritebackFailedAt: metadata.ehrWritebackFailedAt,
        ehrWritebackNoteId: metadata.ehrWritebackNoteId,
        ehrWritebackReviewUrl: metadata.ehrWritebackReviewUrl,
        ehrWritebackPatientId: metadata.ehrWritebackPatientId,
        ehrWritebackSupportedInteractions: metadata.ehrWritebackSupportedInteractions,
      }
    }

    return NextResponse.json({
      status: result.status,
      reason: result.reason,
      ...(writebackMeta ? { writebackMeta } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retry EHR writeback'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
