import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { previewTemplateSchema } from '@/lib/validations'
import { renderEmailFromJson } from '@/lib/marketing/render-email'
import { renderSmsText } from '@/lib/marketing/render-sms'
import { lintTemplate } from '@/lib/marketing/lint'
import { VariableContext } from '@/lib/marketing/types'

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
    
    const body = await req.json()
    const { sampleContext } = previewTemplateSchema.parse({ templateId: id, sampleContext: body.sampleContext })
    
    // Get template
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
    
    // Get brand profile
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { tenantId: user.practiceId },
    })
    
    // Build context with defaults
    const context: VariableContext = {
      patient: sampleContext?.patient || {
        firstName: 'John',
        lastName: 'Doe',
        preferredName: 'John',
      },
      practice: sampleContext?.practice || {
        name: brandProfile?.practiceName || user.name || 'Practice',
        phone: brandProfile?.defaultFromEmail || '',
        address: '',
      },
      appointment: sampleContext?.appointment || {
        date: 'Monday, January 15, 2024',
        time: '2:00 PM',
        location: 'Main Office',
        providerName: 'Dr. Smith',
      },
      links: sampleContext?.links || {
        confirm: 'https://example.com/confirm',
        reschedule: 'https://example.com/reschedule',
        cancel: 'https://example.com/cancel',
      },
    }
    
    let renderedHtml: string | undefined
    let renderedText: string | undefined
    
    // Render based on channel
    if (template.channel === 'email') {
      if (template.editorType === 'html' && template.bodyHtml) {
        // For HTML editor, use bodyHtml directly (variables already replaced)
        renderedHtml = template.bodyHtml
        // Generate text version (basic)
        renderedText = template.bodyHtml.replace(/<[^>]+>/g, '').replace(/\n/g, ' ')
      } else if (template.editorType === 'dragdrop' && template.bodyJson) {
        // For drag-drop, render from JSON
        const rendered = renderEmailFromJson(
          template.bodyJson as any,
          brandProfile,
          context
        )
        renderedHtml = rendered.html
        renderedText = rendered.text
      } else {
        renderedHtml = template.bodyHtml || ''
        renderedText = template.bodyText || ''
      }
      
      // Replace variables in subject if present
      const subject = template.subject
        ? template.subject.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
            const value = context.patient?.[key as keyof typeof context.patient] || 
                         context.practice?.[key as keyof typeof context.practice] || 
                         context.appointment?.[key as keyof typeof context.appointment] || 
                         match
            return String(value)
          })
        : template.subject
    } else {
      // SMS
      renderedText = renderSmsText(
        template.bodyText || '',
        brandProfile,
        context
      )
    }
    
    // Lint the template
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
    
    return NextResponse.json({
      html: renderedHtml,
      text: renderedText,
      subject: template.subject,
      preheader: template.preheader,
      lintResult,
    })
  } catch (error: any) {
    console.error('Error previewing template:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to preview template' },
      { status: 500 }
    )
  }
}
