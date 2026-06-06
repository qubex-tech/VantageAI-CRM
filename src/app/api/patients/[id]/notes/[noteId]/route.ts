import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { createAuditLog } from '@/lib/audit'
import { syncPatientNoteToEhr } from '@/lib/integrations/ehr/patientNoteSync'
import { isPatientNoteType, PATIENT_NOTE_TYPES } from '@/lib/patient-note-types'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/patients/[id]/notes/[noteId]
 * Update a note
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId, noteId } = await params

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { type, content } = body

    // Get existing note
    const existingNote = await prisma.patientNote.findFirst({
      where: {
        id: noteId,
        patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (type !== undefined) {
      if (!isPatientNoteType(type)) {
        return NextResponse.json(
          { error: `Invalid note type. Must be one of: ${PATIENT_NOTE_TYPES.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.type = type
    }
    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return NextResponse.json(
          { error: 'Content cannot be empty' },
          { status: 400 }
        )
      }
      updateData.content = content.trim()
    }

    // Update note
    const note = await prisma.patientNote.update({
      where: { id: noteId },
      data: updateData,
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
      action: 'update',
      resourceType: 'patient',
      resourceId: patientId,
      changes: {
        before: { noteType: existingNote.type, content: existingNote.content },
        after: { noteType: note.type, content: note.content },
      },
    })

    let ehrSync: Awaited<ReturnType<typeof syncPatientNoteToEhr>> | undefined
    try {
      ehrSync = await syncPatientNoteToEhr({
        practiceId: user.practiceId,
        patientId,
        noteType: note.type,
        content: note.content,
        actorUserId: user.id,
      })
    } catch (error) {
      console.error('Failed to sync updated note to eCW:', error)
    }

    return NextResponse.json({ note, ehrSync })
  } catch (error) {
    console.error('Error updating patient note:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update note' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/patients/[id]/notes/[noteId]
 * Soft delete a note
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId, noteId } = await params

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    // Get existing note
    const existingNote = await prisma.patientNote.findFirst({
      where: {
        id: noteId,
        patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.patientNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    })

    // Audit log
    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'delete',
      resourceType: 'patient',
      resourceId: patientId,
      changes: { before: { noteType: existingNote.type, content: existingNote.content } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting patient note:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete note' },
      { status: 500 }
    )
  }
}

