import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { patientSchema } from '@/lib/validations'
import { createAuditLog, createTimelineEntry } from '@/lib/audit'
import { tenantScope } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '50')

    const patients = await prisma.patient.findMany({
      where: {
        practiceId: user.practiceId,
        deletedAt: null,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ]
          : undefined,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        tags: true,
        _count: {
          select: {
            appointments: true,
            insurancePolicies: true,
          },
        },
      },
    })

    return NextResponse.json({ patients })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch patients' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const validated = patientSchema.parse(body)

    const patient = await prisma.patient.create({
      data: {
        ...validated,
        practiceId: user.practiceId,
        tags: validated.tags
          ? {
              create: validated.tags.map((tag) => ({ tag })),
            }
          : undefined,
      },
      include: {
        tags: true,
      },
    })

    await createAuditLog({
      practiceId: user.practiceId,
      userId: user.id,
      action: 'create',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: { after: patient },
    })

    // Log patient creation activity
    const { logCustomActivity } = await import('@/lib/patient-activity')
    await logCustomActivity({
      patientId: patient.id,
      type: 'note',
      title: 'Patient created',
      description: 'Patient record was created',
      userId: user.id,
    })

    return NextResponse.json({ patient }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create patient' },
      { status: 500 }
    )
  }
}

