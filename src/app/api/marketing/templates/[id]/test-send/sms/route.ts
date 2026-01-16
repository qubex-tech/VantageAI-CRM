import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { testSendSmsSchema } from '@/lib/validations'
import { renderSmsText } from '@/lib/marketing/render-sms'
import { getTwilioClient } from '@/lib/twilio'
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
    const { to, sampleContext } = testSendSmsSchema.parse({ templateId: id, ...body })
    
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
    
    // Check if SMS template
    if (template.channel !== 'sms') {
      return NextResponse.json(
        { error: 'Template is not an SMS template' },
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
            error: 'Cannot send test SMS during quiet hours',
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
    
    // Render SMS
    const message = renderSmsText(
      template.bodyText || '',
      brandProfile,
      context
    )
    
    // Send SMS via provider
    const from = brandProfile?.defaultSmsSenderId || 'PRACTICE'
    
    const twilioClient = await getTwilioClient(user.practiceId)
    const result = await twilioClient.sendSms({
      to,
      body: message,
      from,
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
        channel: 'sms',
        to,
        messageId: result.messageId,
        success: result.success,
        messageLength: message.length,
      },
    })
    
    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      rendered: { text: message },
    })
  } catch (error: any) {
    console.error('Error sending test SMS:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to send test SMS' },
      { status: 500 }
    )
  }
}
