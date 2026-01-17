import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { patientSchema } from '@/lib/validations'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'
import { tenantScope } from '@/lib/db'
import { logPatientChanges } from '@/lib/patient-activity'
import { emitEvent } from '@/lib/outbox'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const patient = await prisma.patient.findFirst({
      where: {
        id,
        practiceId: practiceId,
        deletedAt: null,
      },
      include: {
        tags: true,
        insurancePolicies: true,
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 10,
        },
        timelineEntries: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ patient })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch patient' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params
    const body = await req.json()

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    // Get existing patient
    const existing = await prisma.patient.findFirst({
      where: {
        id,
        practiceId: practiceId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const validated = patientSchema.partial().parse(body)

    const updateData: any = { ...validated }
    delete updateData.tags

    // Ensure required fields are maintained if not provided
    // Phone is required in Prisma schema, so ensure it's set
    if (!updateData.phone && !updateData.primaryPhone) {
      // Keep existing phone if not updating
      updateData.phone = existing.phone
    } else if (updateData.primaryPhone && !updateData.phone) {
      // Use primaryPhone as phone if phone not provided
      updateData.phone = updateData.primaryPhone
    } else if (updateData.phone && !updateData.primaryPhone) {
      // Use phone as primaryPhone if primaryPhone not provided
      updateData.primaryPhone = updateData.phone
    }

    // Ensure name is set (required in Prisma)
    if (!updateData.name) {
      // Construct from firstName/lastName if available, otherwise keep existing
      if (updateData.firstName || updateData.lastName) {
        updateData.name = [updateData.firstName, updateData.lastName].filter(Boolean).join(' ').trim() || existing.name
      } else {
        updateData.name = existing.name
      }
    }

    // Ensure preferredContactMethod is set (required in Prisma)
    if (!updateData.preferredContactMethod) {
      updateData.preferredContactMethod = existing.preferredContactMethod
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
      include: {
        tags: true,
      },
    })

    // Handle tags update
    if (validated.tags !== undefined) {
      // Delete existing tags
      await prisma.patientTag.deleteMany({
        where: { patientId: id },
      })

      // Create new tags
      if (validated.tags.length > 0) {
        await prisma.patientTag.createMany({
          data: validated.tags.map((tag) => ({
            patientId: id,
            tag,
          })),
          skipDuplicates: true,
        })
      }

      // Reload patient with tags
      const updated = await prisma.patient.findUnique({
        where: { id },
        include: { tags: true },
      })
      
      if (updated) {
        Object.assign(patient, updated)
      } else {
        // Patient was deleted between update and reload
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
    }

    await createAuditLog({
      practiceId: practiceId,
      userId: user.id,
      action: 'update',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: {
        before: existing,
        after: patient,
      },
    })

    // Log patient changes to timeline (automatically detects what changed)
    await logPatientChanges({
      patientId: patient.id,
      oldPatient: existing,
      newPatient: patient,
      userId: user.id,
      excludedFields: ['tags'], // Tags are handled separately
    })

    // Emit event for automation
    await emitEvent({
      practiceId,
      eventName: 'crm/patient.updated',
      entityType: 'patient',
      entityId: patient.id,
      data: {
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          preferredContactMethod: patient.preferredContactMethod,
        },
        changes: validated,
        userId: user.id,
      },
    })

    return NextResponse.json({ patient })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update patient' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId

    const existing = await prisma.patient.findFirst({
      where: {
        id,
        practiceId: practiceId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Soft delete
    const patient = await prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await createAuditLog({
      practiceId: practiceId,
      userId: user.id,
      action: 'delete',
      resourceType: 'patient',
      resourceId: patient.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete patient' },
      { status: 500 }
    )
  }
}

