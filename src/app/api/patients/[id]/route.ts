import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { patientSchema } from '@/lib/validations'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'
import { tenantScope } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const user = await requireAuth(req)

    const patient = await prisma.patient.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
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

    // Get existing patient
    const existing = await prisma.patient.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const validated = patientSchema.partial().parse(body)

    const updateData: any = { ...validated }
    delete updateData.tags

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
      practiceId: user.practiceId,
      userId: user.id,
      action: 'update',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: {
        before: existing,
        after: patient,
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

    const existing = await prisma.patient.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
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
      practiceId: user.practiceId,
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

