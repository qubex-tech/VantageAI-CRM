import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getSendgridClient } from '@/lib/sendgrid'
import { prisma } from '@/lib/db'
import { logEmailActivity } from '@/lib/patient-activity'

export const dynamic = 'force-dynamic'

/**
 * Send email to a patient via SendGrid
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { to, toName, subject, htmlContent, textContent, patientId } = body

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
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'SendGrid integration is not configured. Please configure it in Settings → SendGrid Integration.'
      return NextResponse.json(
        { error: errorMessage },
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
      return NextResponse.json(
        { error: result.error || 'Failed to send email via SendGrid' },
        { status: 500 }
      )
    }

    // Log email activity if patientId is provided, or find patient by email
    if (patientId) {
      // Direct patient ID provided
      await logEmailActivity({
        patientId,
        to,
        subject,
        messageId: result.messageId,
        userId: user.id,
      })
    } else if (to) {
      // Try to find patient by email address
      try {
        const patient = await prisma.patient.findFirst({
          where: {
            practiceId: user.practiceId,
            email: to,
            deletedAt: null,
          },
          select: { id: true },
        })

        if (patient) {
          await logEmailActivity({
            patientId: patient.id,
            to,
            subject,
            messageId: result.messageId,
            userId: user.id,
          })
        }
      } catch (error) {
        // Don't fail the request if activity logging fails
        console.error('[EMAIL SEND] Error logging email activity:', error)
      }
    }

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

