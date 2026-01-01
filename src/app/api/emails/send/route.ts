import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getSendgridClient } from '@/lib/sendgrid'

export const dynamic = 'force-dynamic'

/**
 * Send email to a patient via SendGrid
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[EMAIL SEND] Starting email send request')
    const user = await requireAuth(req)
    console.log('[EMAIL SEND] User authenticated:', user.practiceId)
    
    const body = await req.json()
    console.log('[EMAIL SEND] Request body:', { to: body.to, subject: body.subject, hasContent: !!(body.htmlContent || body.textContent) })

    const { to, toName, subject, htmlContent, textContent } = body

    // Validate required fields
    if (!to || !subject || (!htmlContent && !textContent)) {
      console.log('[EMAIL SEND] Validation failed: missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and content are required' },
        { status: 400 }
      )
    }

    // Get SendGrid client for this practice
    let sendgridClient
    try {
      console.log('[EMAIL SEND] Getting SendGrid client for practice:', user.practiceId)
      sendgridClient = await getSendgridClient(user.practiceId)
      console.log('[EMAIL SEND] SendGrid client obtained successfully')
    } catch (error) {
      console.error('[EMAIL SEND] Error getting SendGrid client:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'SendGrid integration is not configured. Please configure it in Settings → SendGrid Integration.'
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    // Send the email
    console.log('[EMAIL SEND] Calling sendEmail with params:', { to, subject })
    const result = await sendgridClient.sendEmail({
      to,
      toName,
      subject,
      htmlContent,
      textContent,
    })

    console.log('[EMAIL SEND] SendEmail result:', { success: result.success, hasError: !!result.error, messageId: result.messageId })

    if (!result.success) {
      console.error('[EMAIL SEND] SendGrid sendEmail failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to send email via SendGrid' },
        { status: 500 }
      )
    }

    console.log('[EMAIL SEND] Email sent successfully, messageId:', result.messageId)
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('[EMAIL SEND] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}

