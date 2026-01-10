import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { testSendEmailSchema } from '@/lib/validations'
import { renderEmailFromJson } from '@/lib/marketing/render-email'
import { stubEmailProvider } from '@/lib/marketing/providers'
import { createMarketingAuditLog } from '@/lib/marketing/audit'
import { quietHoursCheck } from '@/lib/marketing/lint'
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
    const { to, sampleContext } = testSendEmailSchema.parse({ templateId: id, ...body })
    
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
    
    // Check if email template
    if (template.channel !== 'email') {
      return NextResponse.json(
        { error: 'Template is not an email template' },
        { status: 400 }
      )
    }
    
    // Get brand profile
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { tenantId: user.practiceId },
    })
    
    // Check quiet hours
    if (brandProfile) {
      const now = new Date()
      const inQuietHours = quietHoursCheck(
        now,
        brandProfile.timezone,
        brandProfile.quietHoursStart,
        brandProfile.quietHoursEnd
      )
      
      if (inQuietHours) {
        return NextResponse.json(
          {
            error: 'Cannot send test email during quiet hours',
            quietHours: {
              start: brandProfile.quietHoursStart,
              end: brandProfile.quietHoursEnd,
              timezone: brandProfile.timezone,
            },
          },
          { status: 400 }
        )
      }
    }
    
    // Build context
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
    
    // Render email
    let html: string
    let text: string
    
    if (template.editorType === 'html' && template.bodyHtml) {
      html = template.bodyHtml
      text = template.bodyHtml.replace(/<[^>]+>/g, '').replace(/\n/g, ' ')
    } else if (template.editorType === 'dragdrop' && template.bodyJson) {
      const rendered = renderEmailFromJson(
        template.bodyJson as any,
        brandProfile,
        context
      )
      html = rendered.html
      text = rendered.text
    } else {
      html = template.bodyHtml || ''
      text = template.bodyText || ''
    }
    
    // Replace variables in subject
    const subject = template.subject
      ? template.subject.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
          const value = context.patient?.[key as keyof typeof context.patient] || 
                       context.practice?.[key as keyof typeof context.practice] || 
                       context.appointment?.[key as keyof typeof context.appointment] || 
                       match
          return String(value)
        })
      : 'Test Email'
    
    // Send email via provider
    const from = brandProfile?.defaultFromEmail || user.email || 'noreply@practice.com'
    const fromName = brandProfile?.defaultFromName || user.name || 'Practice'
    const replyTo = brandProfile?.defaultReplyToEmail || from
    
    const result = await stubEmailProvider.sendEmail({
      to,
      from,
      fromName,
      replyTo,
      subject,
      html,
      text,
    })
    
    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'TEST_SENT',
      entityType: 'Template',
      entityId: template.id,
      metadata: {
        channel: 'email',
        to,
        messageId: result.messageId,
        success: result.success,
      },
    })
    
    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      rendered: { html, text, subject },
    })
  } catch (error: any) {
    console.error('Error sending test email:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    )
  }
}
