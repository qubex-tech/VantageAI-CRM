import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { syncPatientInsuranceFromEhr } from '@/lib/ehr/syncPatientInsuranceFromEhr'
import { getEcwDocumentationConfigGaps } from '@/lib/ehr/vantageEcwBackend'

export const dynamic = 'force-dynamic'

/**
 * POST /api/patients/[id]/insurance/sync-from-ehr
 * Pulls Coverage + Organization (Payor) from eCW and upserts local InsurancePolicy rows.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    if (!patient.externalEhrId?.trim()) {
      return NextResponse.json(
        {
          ok: false,
          reason: 'patient_not_linked_to_ehr',
          message: 'Link this patient to eCW (external EHR patient id) before syncing insurance.',
        },
        { status: 400 }
      )
    }

    const result = await syncPatientInsuranceFromEhr({
      practiceId: user.practiceId,
      patientId,
      actorUserId: user.id,
    })

    if (result.status === 'skipped' && result.reason === 'ecw_not_configured') {
      const configGaps = await getEcwDocumentationConfigGaps(user.practiceId)
      return NextResponse.json(
        { ok: false, reason: result.reason, configGaps },
        { status: 503 }
      )
    }

    if (result.status === 'skipped') {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 })
    }

    if (result.status === 'error') {
      return NextResponse.json({ ok: false, error: result.message }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      syncedCount: result.syncedCount,
      insuranceStatus: result.insuranceStatus,
      policies: result.policies,
      coveragesFromEhr: result.coveragesFromEhr.map((c) => ({
        coverageId: c.coverageId,
        status: c.status,
        memberId: c.memberId,
        groupNumber: c.groupNumber,
        planName: c.planName,
        planCode: c.planCode,
        eligibilityStatus: c.eligibilityStatus,
        payorName: c.payorName,
        payorPhone: c.payorPhone,
        payorAddress: c.payorAddress,
        isPrimary: c.isPrimary,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync insurance from eCW' },
      { status: 500 }
    )
  }
}
