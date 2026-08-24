import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { fetchEcwPatientLabs } from '@/lib/ehr/ecwPatientLabs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, practiceId: user.practiceId, deletedAt: null },
      select: { id: true, externalEhrId: true },
    })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const connection = await prisma.ehrConnection.findFirst({
      where: {
        tenantId: user.practiceId,
        providerId: 'ecw_write',
        authFlow: 'backend_services',
        status: { in: ['connected', 'error', 'expired'] },
      },
      select: { id: true },
    })
    if (!connection) {
      return NextResponse.json({
        configured: false as const,
        message: 'eCW write connection is not set up for this practice.',
        panels: [],
        orders: [],
      })
    }

    if (!patient.externalEhrId?.trim()) {
      return NextResponse.json({
        configured: true as const,
        patientLinked: false as const,
        message: 'This patient is not linked to eCW (missing external EHR patient id).',
        panels: [],
        orders: [],
      })
    }

    const { panels, orders } = await fetchEcwPatientLabs({
      practiceId: user.practiceId,
      externalEhrId: patient.externalEhrId,
    })

    return NextResponse.json({
      configured: true as const,
      patientLinked: true as const,
      panels,
      orders,
    })
  } catch (error) {
    console.error('[labs]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load labs' },
      { status: 500 }
    )
  }
}
