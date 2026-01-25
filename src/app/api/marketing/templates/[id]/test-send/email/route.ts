import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { testSendEmailSchema } from '@/lib/validations'
import { renderEmailFromJson } from '@/lib/marketing/render-email'
import { replaceVariables } from '@/lib/marketing/variables'
import { getSendgridClient } from '@/lib/sendgrid'
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
        portalVerified: 'https://portal.getvantage.tech/portal/invite?token=EXAMPLE',
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
    
    // Replace variables in subject using the proper variable replacement function
    const subject = template.subject
      ? replaceVariables(template.subject, context)
      : 'Test Email'
    
    // Send email via SendGrid using verified sender email
    // SendGrid requires the fromEmail to be verified, otherwise emails won't send
    // The SendgridApiClient from getSendgridClient() already has the verified fromEmail set
    let result: { success: boolean; messageId?: string; error?: string }
    
    try {
      const sendgridClient = await getSendgridClient(user.practiceId)
      
      // Get SendGrid integration to access verified sender details
      const sendgridIntegration = await prisma.sendgridIntegration.findFirst({
        where: {
          practiceId: user.practiceId,
          isActive: true,
        },
      })
      
      if (!sendgridIntegration) {
        throw new Error('SendGrid integration not configured or not active')
      }
      
      // Use verified fromName from SendGrid integration, fallback to brand profile
      const verifiedFromName = sendgridIntegration.fromName || brandProfile?.defaultFromName || user.name || 'Practice'
      const verifiedFromEmail = sendgridIntegration.fromEmail
      const replyTo = brandProfile?.defaultReplyToEmail || verifiedFromEmail
      
      result = await sendgridClient.sendEmail({
        to,
        toName: undefined,
        subject,
        htmlContent: html,
        textContent: text,
        // Don't pass fromEmail - the SendgridApiClient uses its verified default fromEmail
        // (set in constructor from SendGrid integration, which is verified and will actually send)
        fromName: verifiedFromName,
        replyTo: replyTo !== verifiedFromEmail ? replyTo : undefined,
      })
      
      // Check if SendGrid returned an error
      if (!result.success) {
        return NextResponse.json(
          {
            error: result.error || 'Failed to send email via SendGrid',
            rendered: { html, text, subject },
          },
          { status: 500 }
        )
      }
    } catch (sendgridError: any) {
      // If SendGrid is not configured, return clear error message
      if (sendgridError.message?.includes('not configured') || 
          sendgridError.message?.includes('not found') ||
          sendgridError.message?.includes('not active')) {
        return NextResponse.json(
          {
            error: 'SendGrid integration is not configured. Please configure it in Settings → SendGrid Integration.',
            rendered: { html, text, subject },
            requiresConfiguration: true,
          },
          { status: 400 }
        )
      }
      
      // For other errors, return the error message
      console.error('SendGrid error:', sendgridError)
      return NextResponse.json(
        {
          error: sendgridError.message || 'Failed to send email via SendGrid',
          rendered: { html, text, subject },
        },
        { status: 500 }
      )
    }
    
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
