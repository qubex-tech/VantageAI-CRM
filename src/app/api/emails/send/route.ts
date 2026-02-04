import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { getSendgridClient } from '@/lib/sendgrid'
import { prisma } from '@/lib/db'
import { logEmailActivity } from '@/lib/patient-activity'
import { logOutboundCommunication } from '@/lib/communications/logging'

export const dynamic = 'force-dynamic'

/**
 * Send email to a patient via SendGrid
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()

    const { to, toName, subject, htmlContent, textContent, patientId } = body
    const bodyText =
      textContent ||
      (htmlContent ? String(htmlContent).replace(/<[^>]*>/g, '') : '')

    console.log('[EMAIL SEND] Received request body:', { to, subject, hasPatientId: !!patientId, patientId })

    // Validate required fields
    if (!to || !subject || (!htmlContent && !textContent)) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and content are required' },
        { status: 400 }
      )
    }

    // Get SendGrid client for this practice
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }
    const practiceId = user.practiceId
    
    let sendgridClient
    try {
      sendgridClient = await getSendgridClient(practiceId)
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
    // IMPORTANT: Do this BEFORE returning the response to ensure it completes
    let resolvedPatientId: string | null = null
    try {
      if (patientId && typeof patientId === 'string' && patientId.trim() !== '') {
        // Direct patient ID provided
        console.log('[EMAIL SEND] Logging email activity for patientId:', patientId)
        await logEmailActivity({
          patientId: patientId.trim(),
          to,
          subject,
          messageId: result.messageId,
          userId: user.id,
        })
        console.log('[EMAIL SEND] Successfully logged email activity for patientId:', patientId)
        resolvedPatientId = patientId.trim()
      } else if (to) {
        // Try to find patient by email address
        console.log('[EMAIL SEND] Looking up patient by email:', to)
        const patient = await prisma.patient.findFirst({
          where: {
            practiceId: practiceId,
            email: to,
            deletedAt: null,
          },
          select: { id: true },
        })

        if (patient) {
          console.log('[EMAIL SEND] Found patient by email, logging activity for patientId:', patient.id)
          await logEmailActivity({
            patientId: patient.id,
            to,
            subject,
            messageId: result.messageId,
            userId: user.id,
          })
          console.log('[EMAIL SEND] Successfully logged email activity')
          resolvedPatientId = patient.id
        } else {
          console.log('[EMAIL SEND] No patient found with email:', to)
        }
      }
    } catch (error) {
      // Don't fail the request if activity logging fails, but log the error
      console.error('[EMAIL SEND] Error logging email activity:', error)
    }

    if (resolvedPatientId) {
      try {
        await logOutboundCommunication({
          practiceId,
          patientId: resolvedPatientId,
          channel: 'email',
          body: bodyText || String(subject || ''),
          userId: user.id,
          subject: subject || undefined,
          metadata: {
            to,
            providerMessageId: result.messageId,
            subject,
          },
        })
      } catch (error) {
        console.error('[EMAIL SEND] Error logging inbox message:', error)
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

