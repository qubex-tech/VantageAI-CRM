import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { getOrCreateVerifiedPatientPortalUrl } from '@/lib/patient-auth'
import { getSendgridClient } from '@/lib/sendgrid'
import { getTwilioClient } from '@/lib/twilio'
import { logEmailActivity, logPatientActivity } from '@/lib/patient-activity'

export const dynamic = 'force-dynamic'

const sendPortalInviteSchema = z.object({
  channel: z.enum(['email', 'sms', 'auto']).default('auto'),
})

function normalizePhoneDigits(value: string) {
  return value.replace(/[^\d]/g, '')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = sendPortalInviteSchema.parse(body)

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        primaryPhone: true,
        secondaryPhone: true,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const urlResult = await getOrCreateVerifiedPatientPortalUrl({
      practiceId: user.practiceId,
      patientId: patient.id,
    })

    const email = patient.email?.trim() || null
    const phone = (patient.primaryPhone || patient.phone || patient.secondaryPhone || '').trim()
    const hasPhone = Boolean(normalizePhoneDigits(phone))

    const chosenChannel =
      parsed.channel === 'auto'
        ? email
          ? 'email'
          : hasPhone
            ? 'sms'
            : null
        : parsed.channel

    if (!chosenChannel) {
      return NextResponse.json(
        { error: 'Patient does not have an email or phone number on file.' },
        { status: 400 }
      )
    }

    if (chosenChannel === 'email') {
      if (!email) {
        return NextResponse.json({ error: 'Patient email is missing.' }, { status: 400 })
      }

      const sendgridClient = await getSendgridClient(user.practiceId)

      const subject = 'Your secure link to the Patient Portal'
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <p>Hello ${patient.name || 'there'},</p>
          <p>Use the secure link below to access your Patient Portal:</p>
          <p style="margin: 16px 0;">
            <a href="${urlResult.url}" style="display:inline-block; padding: 10px 14px; background:#111827; color:#ffffff; border-radius:8px; text-decoration:none;">
              Open Patient Portal
            </a>
          </p>
          <p style="font-size: 12px; color: #6b7280;">
            This link expires on ${urlResult.expiresAt.toLocaleDateString()}.
          </p>
          <p style="font-size: 12px; color: #6b7280;">
            If you did not expect this message, you can ignore it.
          </p>
          <hr style="border:none; border-top:1px solid #e5e7eb; margin: 16px 0;" />
          <p style="font-size: 12px; color: #6b7280;">Secure link: ${urlResult.url}</p>
        </div>
      `.trim()

      const textContent = `
Hello ${patient.name || 'there'},

Use the secure link below to access your Patient Portal:
${urlResult.url}

This link expires on ${urlResult.expiresAt.toLocaleDateString()}.
If you did not expect this message, you can ignore it.
      `.trim()

      const result = await sendgridClient.sendEmail({
        to: email,
        toName: patient.name || undefined,
        subject,
        htmlContent,
        textContent,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
      }

      await logEmailActivity({
        patientId: patient.id,
        to: email,
        subject,
        messageId: result.messageId,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        channel: 'email',
        sentTo: email,
        url: urlResult.url,
        expiresAt: urlResult.expiresAt,
        messageId: result.messageId,
      })
    }

    // SMS
    if (!hasPhone) {
      return NextResponse.json({ error: 'Patient phone number is missing.' }, { status: 400 })
    }

    const twilioClient = await getTwilioClient(user.practiceId)
    const message = `Secure Patient Portal link: ${urlResult.url} (expires ${urlResult.expiresAt.toLocaleDateString()}).`
    const result = await twilioClient.sendSms({
      to: phone,
      body: message,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 500 })
    }

    await logPatientActivity({
      patientId: patient.id,
      type: 'call',
      title: `Portal invite sent via SMS`,
      description: `Sent to ${phone}`,
      metadata: {
        to: phone,
        messageId: result.messageId,
        userId: user.id,
        inviteExpiresAt: urlResult.expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      channel: 'sms',
      sentTo: phone,
      url: urlResult.url,
      expiresAt: urlResult.expiresAt,
      messageId: result.messageId,
    })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send portal invite' },
      { status: 500 }
    )
  }
}

