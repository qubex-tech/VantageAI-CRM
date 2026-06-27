import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { createAuditLog } from '@/lib/audit'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'
import { syncPatientNoteToOpenDental } from '@/lib/integrations/opendental/commlogWriteback'
import { isPatientNoteType, PATIENT_NOTE_TYPES } from '@/lib/patient-note-types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/patients/[id]/notes
 * Get all notes for a patient
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const notes = await prisma.patientNote.findMany({
      where: {
        patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Error fetching patient notes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/patients/[id]/notes
 * Create a new note for a patient (always saved in Vantage; eCW sync per practice config).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { type, content } = body

    if (!type || !content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Type and content are required' },
        { status: 400 }
      )
    }

    if (!isPatientNoteType(type)) {
      return NextResponse.json(
        { error: `Invalid note type. Must be one of: ${PATIENT_NOTE_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const note = await prisma.patientNote.create({
      data: {
        patientId,
        practiceId: user.practiceId,
        userId: user.id,
        type,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'create',
      resourceType: 'patient',
      resourceId: patientId,
      changes: { after: { noteType: type, content: content.trim() } },
    })

    let ehrSync: Awaited<ReturnType<typeof syncPatientNoteToEhr>> | undefined
    try {
      ehrSync = await syncPatientNoteToEhr({
        practiceId: user.practiceId,
        patientId,
        noteType: type,
        content: content.trim(),
        actorUserId: user.id,
      })
    } catch (error) {
      console.error('Failed to sync note to eCW:', error)
      ehrSync = { status: 'error', mode: 'none', reason: 'sync_exception' }
    }

    let openDentalSync: Awaited<ReturnType<typeof syncPatientNoteToOpenDental>> | undefined
    try {
      openDentalSync = await syncPatientNoteToOpenDental({
        practiceId: user.practiceId,
        patientId,
        noteType: type,
        content: content.trim(),
        actorUserId: user.id,
      })
    } catch (error) {
      console.error('Failed to sync note to Open Dental:', error)
      openDentalSync = { status: 'error', reason: 'sync_exception' }
    }

    return NextResponse.json({ note, ehrSync, openDentalSync }, { status: 201 })
  } catch (error) {
    console.error('Error creating patient note:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create note' },
      { status: 500 }
    )
  }
}
