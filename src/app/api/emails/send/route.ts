import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getSendgridClient } from '@/lib/sendgrid'

export const dynamic = 'force-dynamic'

/**
 * Send email to a patient via SendGrid
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { to, toName, subject, htmlContent, textContent } = body

    // Validate required fields
    if (!to || !subject || (!htmlContent && !textContent)) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and content are required' },
        { status: 400 }
      )
    }

    // Get SendGrid client for this practice
    let sendgridClient
    try {
      sendgridClient = await getSendgridClient(user.practiceId)
    } catch (error) {
      console.error('Error getting SendGrid client:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'SendGrid integration not configured. Please configure it in Settings.' },
        { status: 400 }
      )
    }

    // Send the email
    const result = await sendgridClient.sendEmail({
      to,
      toName,
      subject,
      htmlContent,
      textContent,
    })

    if (!result.success) {
      console.error('SendGrid sendEmail failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to send email via SendGrid' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}

