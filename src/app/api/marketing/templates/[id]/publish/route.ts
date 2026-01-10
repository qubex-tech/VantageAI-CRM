import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { createMarketingAuditLog } from '@/lib/marketing/audit'
import { lintTemplate } from '@/lib/marketing/lint'

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
    
    // Get template and brand profile
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
    
    // Cannot publish archived templates
    if (template.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot publish archived template' },
        { status: 400 }
      )
    }
    
    // Get brand profile for linting
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { tenantId: user.practiceId },
    })
    
    // Lint template
    const lintResult = lintTemplate(
      template.channel as any,
      {
        subject: template.subject,
        preheader: template.preheader,
        bodyJson: template.bodyJson as any,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
        editorType: template.editorType,
      },
      brandProfile
    )
    
    // Block publish if there are errors
    if (!lintResult.isValid) {
      return NextResponse.json(
        {
          error: 'Template validation failed',
          lintResult,
        },
        { status: 400 }
      )
    }
    
    // Get current version number
    const latestVersion = await prisma.marketingTemplateVersion.findFirst({
      where: { templateId: id },
      orderBy: { versionNumber: 'desc' },
      take: 1,
    })
    
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1
    
    // Create version snapshot
    const snapshot = {
      id: template.id,
      channel: template.channel,
      name: template.name,
      category: template.category,
      subject: template.subject,
      preheader: template.preheader,
      bodyJson: template.bodyJson,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      editorType: template.editorType,
      variablesUsed: template.variablesUsed,
      complianceConfig: template.complianceConfig,
    }
    
    await prisma.marketingTemplateVersion.create({
      data: {
        templateId: id,
        tenantId: user.practiceId,
        versionNumber: nextVersionNumber,
        snapshot: snapshot as any,
        createdByUserId: user.id,
      },
    })
    
    // Update template status
    const updatedTemplate = await prisma.marketingTemplate.update({
      where: { id },
      data: {
        status: 'published',
        lastPublishedAt: new Date(),
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
      action: 'TEMPLATE_PUBLISHED',
      entityType: 'Template',
      entityId: template.id,
      metadata: { versionNumber: nextVersionNumber, lintWarnings: lintResult.warnings },
    })
    
    return NextResponse.json({
      template: updatedTemplate,
      lintResult,
    })
  } catch (error: any) {
    console.error('Error publishing template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to publish template' },
      { status: 500 }
    )
  }
}
