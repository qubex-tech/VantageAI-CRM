import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { marketingTemplateSchema } from '@/lib/validations'
import { createMarketingAuditLog } from '@/lib/marketing/audit'
import { extractVariables } from '@/lib/marketing/variables'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }
    
    const searchParams = req.nextUrl.searchParams
    const channel = searchParams.get('channel') as 'email' | 'sms' | null
    const status = searchParams.get('status') as 'draft' | 'published' | 'archived' | null
    const category = searchParams.get('category') as string | null
    const search = searchParams.get('q') || ''
    
    const where: any = {
      tenantId: user.practiceId,
    }
    
    if (channel) {
      where.channel = channel
    }
    
    if (status) {
      where.status = status
    }
    
    if (category) {
      where.category = category
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { subject: { contains: search, mode: 'insensitive' as const } },
        { bodyText: { contains: search, mode: 'insensitive' as const } },
      ]
    }
    
    const templates = await prisma.marketingTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
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
    
    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }
    
    const body = await req.json()
    const validated = marketingTemplateSchema.parse(body)
    
    // Determine editor type based on channel if not provided
    let editorType = validated.editorType
    if (!editorType) {
      editorType = validated.channel === 'sms' ? 'plaintext' : 'dragdrop'
    }
    
    // Extract variables from content
    const content = validated.bodyHtml || validated.bodyText || JSON.stringify(validated.bodyJson || {})
    const variablesUsed = extractVariables(content)
    if (validated.subject) {
      const subjectVars = extractVariables(validated.subject)
      variablesUsed.push(...subjectVars)
    }
    
    // Create template
    const template = await prisma.marketingTemplate.create({
      data: {
        tenantId: user.practiceId,
        createdByUserId: user.id,
        ...validated,
        editorType,
        variablesUsed: [...new Set(variablesUsed)], // Deduplicate
        status: validated.status || 'draft',
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
      action: 'TEMPLATE_CREATED',
      entityType: 'Template',
      entityId: template.id,
      metadata: { channel: template.channel, category: template.category },
    })
    
    return NextResponse.json({ template }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating template:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    )
  }
}
