import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveEhrPractice } from '@/lib/integrations/ehr/server'
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

    return NextResponse.json({ status: result.status, reason: result.reason })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retry EHR writeback'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
