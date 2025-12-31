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
    const sendgridClient = await getSendgridClient(user.practiceId)

    // Send the email
    const result = await sendgridClient.sendEmail({
      to,
      toName,
      subject,
      htmlContent,
      textContent,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
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

