import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const NOTE_TYPES = [
  'general',
  'medical',
  'administrative',
  'billing',
  'appointment',
  'medication',
  'allergy',
  'contact',
  'insurance',
  'other',
] as const

type NoteType = typeof NOTE_TYPES[number]

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

    // Verify patient belongs to practice
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

    // Get notes (excluding soft-deleted)
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
 * Create a new note for a patient
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

    // Validate input
    if (!type || !content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Type and content are required' },
        { status: 400 }
      )
    }

    if (!NOTE_TYPES.includes(type as NoteType)) {
      return NextResponse.json(
        { error: `Invalid note type. Must be one of: ${NOTE_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify patient belongs to practice
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

    // Create note
    const note = await prisma.patientNote.create({
      data: {
        patientId,
        practiceId: user.practiceId,
        userId: user.id,
        type: type as NoteType,
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

    // Audit log
    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'create',
      resourceType: 'patient',
      resourceId: patientId,
      changes: { after: { noteType: type, content: content.trim() } },
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    console.error('Error creating patient note:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create note' },
      { status: 500 }
    )
  }
}

