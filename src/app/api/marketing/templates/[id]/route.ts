import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { marketingTemplateSchema } from '@/lib/validations'
import { createMarketingAuditLog } from '@/lib/marketing/audit'
import { extractVariables } from '@/lib/marketing/variables'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }
    
    const template = await prisma.marketingTemplate.findFirst({
      where: {
        id,
        tenantId: user.practiceId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 10,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ template })
  } catch (error: any) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id } = await params
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }
    
    // Check if template exists and belongs to tenant
    const existing = await prisma.marketingTemplate.findFirst({
      where: {
        id,
        tenantId: user.practiceId,
      },
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }
    
    // Cannot update archived templates
    if (existing.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot update archived template' },
        { status: 400 }
      )
    }
    
    const body = await req.json()
    const validated = marketingTemplateSchema.partial().parse(body)
    
    // Extract variables if content changed
    let variablesUsed = existing.variablesUsed as string[] | null
    if (validated.bodyHtml || validated.bodyText || validated.bodyJson || validated.subject) {
      const content = validated.bodyHtml || validated.bodyText || JSON.stringify(validated.bodyJson || {}) || existing.bodyHtml || existing.bodyText || JSON.stringify(existing.bodyJson || {})
      variablesUsed = extractVariables(content)
      if (validated.subject || existing.subject) {
        const subjectVars = extractVariables(validated.subject || existing.subject || '')
        variablesUsed.push(...subjectVars)
      }
      variablesUsed = [...new Set(variablesUsed)] // Deduplicate
    }
    
    // Update template (only if not published - or allow updates to published)
    const template = await prisma.marketingTemplate.update({
      where: { id },
      data: {
        ...validated,
        variablesUsed: variablesUsed || undefined,
        // If updating published template, keep it published
        status: existing.status === 'published' && !validated.status ? 'published' : validated.status,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
    
    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'TEMPLATE_UPDATED',
      entityType: 'Template',
      entityId: template.id,
      metadata: { updatedFields: Object.keys(validated) },
    })
    
    return NextResponse.json({ template })
  } catch (error: any) {
    console.error('Error updating template:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    )
  }
}
