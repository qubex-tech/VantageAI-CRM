import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveEhrPractice } from '@/lib/integrations/ehr/server'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'

const bodySchema = z
  .object({
    providerId: z.string(),
    practiceId: z.string().optional(),
    statusUrl: z.string().url().optional(),
    outputUrls: z.array(z.string().url()).optional(),
  })
  .refine((data) => data.statusUrl || (data.outputUrls && data.outputUrls.length > 0), {
    message: 'statusUrl or outputUrls is required',
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
    const { practiceId, user } = authContext

    const { inngest } = await import('@/inngest/client')
    await inngest.send({
      name: 'ehr/bulk.import',
      data: {
        providerId: parsed.data.providerId,
        practiceId,
        statusUrl: parsed.data.statusUrl,
        outputUrls: parsed.data.outputUrls,
      },
    })

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: isApiKeyAuth ? null : user.id,
      action: 'EHR_BULK_IMPORT_START',
      providerId: parsed.data.providerId,
      entity: 'EhrConnection',
      entityId: parsed.data.providerId,
      metadata: {
        statusUrl: parsed.data.statusUrl,
        outputUrls: parsed.data.outputUrls,
      },
    })

    return NextResponse.json({ status: 'queued' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start bulk import'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
