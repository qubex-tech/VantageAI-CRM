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
    
    // Check if template exists
    const template = await prisma.marketingTemplate.findFirst({
      where: {
        id,
        tenantId: user.practiceId,
      },
    })
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }
    
    // Update status to archived
    const updatedTemplate = await prisma.marketingTemplate.update({
      where: { id },
      data: { status: 'archived' },
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
      action: 'TEMPLATE_ARCHIVED',
      entityType: 'Template',
      entityId: template.id,
      metadata: { previousStatus: template.status },
    })
    
    return NextResponse.json({ template: updatedTemplate })
  } catch (error: any) {
    console.error('Error archiving template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to archive template' },
      { status: 500 }
    )
  }
}
