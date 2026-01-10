import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { createMarketingAuditLog } from '@/lib/marketing/audit'

export const dynamic = 'force-dynamic'

export async function POST(
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
    
    // Get original template
    const original = await prisma.marketingTemplate.findFirst({
      where: {
        id,
        tenantId: user.practiceId,
      },
    })
    
    if (!original) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }
    
    // Create duplicate
    const duplicate = await prisma.marketingTemplate.create({
      data: {
        tenantId: user.practiceId,
        createdByUserId: user.id,
        channel: original.channel,
        name: `Copy of ${original.name}`,
        category: original.category,
        status: 'draft',
        editorType: original.editorType,
        subject: original.subject,
        preheader: original.preheader,
        bodyJson: original.bodyJson as any,
        bodyHtml: original.bodyHtml,
        bodyText: original.bodyText,
        variablesUsed: original.variablesUsed as any,
        complianceConfig: original.complianceConfig as any,
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
      action: 'TEMPLATE_DUPLICATED',
      entityType: 'Template',
      entityId: duplicate.id,
      metadata: { originalTemplateId: original.id },
    })
    
    return NextResponse.json({ template: duplicate }, { status: 201 })
  } catch (error: any) {
    console.error('Error duplicating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to duplicate template' },
      { status: 500 }
    )
  }
}
