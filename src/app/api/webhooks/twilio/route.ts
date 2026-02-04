import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logInboundCommunication } from '@/lib/communications/logging'

/**
 * POST /api/webhooks/twilio
 * Handle Twilio webhook (SMS STOP, delivery status)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.formData()
    const messageSid = body.get('MessageSid') as string
    const from = body.get('From') as string
    const to = body.get('To') as string
    const bodyText = body.get('Body') as string
    const messageStatus = body.get('MessageStatus') as string
    const accountSid = body.get('AccountSid') as string

    // Normalize phone number (remove + and keep digits)
    const normalizedFrom = from?.replace(/[^\d]/g, '') || ''
    const normalizedTo = to?.replace(/[^\d]/g, '') || ''

    // Handle STOP keyword (case-insensitive)
    if (bodyText && bodyText.trim().toUpperCase() === 'STOP') {
      // Find patient by phone
      const patient = await prisma.patient.findFirst({
        where: {
          OR: [
            { phone: { contains: normalizedFrom } },
            { primaryPhone: { contains: normalizedFrom } },
            { secondaryPhone: { contains: normalizedFrom } },
          ],
        },
        include: {
          patientAccount: true,
        },
      })

      if (patient) {
        // Get existing communication preferences
        const existingPreferences = await prisma.communicationPreference.findUnique({
          where: { patientId: patient.id },
        })

        // Update communication preferences
        await prisma.communicationPreference.upsert({
          where: { patientId: patient.id },
          create: {
            practiceId: patient.practiceId,
            patientId: patient.id,
            smsEnabled: false,
            emailEnabled: true,
            voiceEnabled: false,
            portalEnabled: true,
          },
          update: {
            smsEnabled: false,
          },
        })

        // Create consent record (opt-out)
        await prisma.consentRecord.create({
          data: {
            practiceId: patient.practiceId,
            patientId: patient.id,
            consentType: 'sms',
            consented: false,
            method: 'sms',
            source: normalizedFrom,
            revokedAt: new Date(),
          },
        })

        // Create audit log
        await prisma.portalAuditLog.create({
          data: {
            practiceId: patient.practiceId,
            patientId: patient.id,
            action: 'opt_out',
            resourceType: 'communication_preference',
            ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
            userAgent: req.headers.get('user-agent') || undefined,
          },
        })

        // Return STOP confirmation (Twilio requires this format)
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from SMS messages. Reply START to opt back in.</Message></Response>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          }
        )
      }
    }

    // Handle inbound SMS (received)
    const isInbound =
      bodyText &&
      bodyText.trim().length > 0 &&
      (!messageStatus || messageStatus === 'received')

    if (isInbound) {
      const integration = await prisma.twilioIntegration.findFirst({
        where: {
          accountSid,
          isActive: true,
        },
        select: { practiceId: true },
      })

      if (integration?.practiceId) {
        const patient = await prisma.patient.findFirst({
          where: {
            practiceId: integration.practiceId,
            deletedAt: null,
            OR: [
              { phone: { contains: normalizedFrom } },
              { primaryPhone: { contains: normalizedFrom } },
              { secondaryPhone: { contains: normalizedFrom } },
            ],
          },
          select: { id: true },
        })

        if (patient) {
          await logInboundCommunication({
            practiceId: integration.practiceId,
            patientId: patient.id,
            channel: 'sms',
            body: bodyText.trim(),
            metadata: {
              from,
              to,
              providerMessageId: messageSid,
              status: messageStatus,
            },
          })
        }
      }
    }

    // Handle delivery status updates
    if (messageSid && messageStatus) {
      // Find messages by metadata (need to query and filter)
      // Note: Prisma doesn't support JSON path queries directly
      // In production, you might store twilioSid in a separate field or use raw query
      const messages = await prisma.portalMessage.findMany({
        where: {
          channel: 'SMS',
          status: { in: ['sent', 'delivered', 'failed'] },
        },
        take: 100, // Limit for performance
      })

      // Filter messages by metadata.twilioSid
      const matchingMessages = messages.filter((msg) => {
        const metadata = msg.metadata as any
        return metadata?.twilioSid === messageSid
      })

      // Update matching messages
      if (matchingMessages.length > 0) {
        await prisma.portalMessage.updateMany({
          where: {
            id: { in: matchingMessages.map((m) => m.id) },
          },
          data: {
            status: messageStatus === 'delivered' ? 'delivered' : messageStatus === 'failed' ? 'failed' : 'sent',
          },
        })
      }
    }

    // Return empty TwiML response
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    )
  } catch (error) {
    console.error('Twilio webhook error:', error)
    // Return empty response even on error (don't expose internal errors)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    )
  }
}
