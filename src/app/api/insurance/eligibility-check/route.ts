import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { runInsuranceVerification } from '@/lib/eligibility/run-insurance-verification'

const bodySchema = z.object({
  patientId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  insurerPhone: z.string().optional(),
  agentId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    const result = await runInsuranceVerification({
      practiceId: user.practiceId,
      userId: user.id,
      patientId: parsed.data.patientId,
      policyId: parsed.data.policyId,
      insurerPhone: parsed.data.insurerPhone,
      agentId: parsed.data.agentId,
      source: 'api',
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[eligibility-check] Failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run eligibility check' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const patientId = req.nextUrl.searchParams.get('patientId')
    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const checks = await prisma.eligibilityCheck.findMany({
      where: { practiceId: user.practiceId, patientId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        policy: {
          select: {
            id: true,
            payerNameRaw: true,
            memberId: true,
            eligibilityStatus: true,
          },
        },
      },
    })

    return NextResponse.json({ checks })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list eligibility checks' },
      { status: 500 }
    )
  }
}
