import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logInboundCommunication } from '@/lib/communications/logging'

function extractEmail(value?: string | null) {
  if (!value) return null
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0].toLowerCase() : null
}

function stripHtml(html?: string | null) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}

/**
 * POST /api/webhooks/sendgrid/inbound
 * Capture inbound email replies for inbox logging.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const fromRaw = form.get('from') as string
    const toRaw = form.get('to') as string
    const subject = (form.get('subject') as string) || ''
    const text = (form.get('text') as string) || ''
    const html = (form.get('html') as string) || ''
    const messageId =
      (form.get('message-id') as string) ||
      (form.get('Message-Id') as string) ||
      undefined

    const fromEmail = extractEmail(fromRaw)
    const toEmail = extractEmail(toRaw)
    if (!fromEmail || !toEmail) {
      return NextResponse.json({ success: true })
    }

    const integration = await prisma.sendgridIntegration.findFirst({
      where: {
        fromEmail: toEmail,
        isActive: true,
      },
      select: { practiceId: true },
    })

    if (!integration?.practiceId) {
      return NextResponse.json({ success: true })
    }

    const patient = await prisma.patient.findFirst({
      where: {
        practiceId: integration.practiceId,
        deletedAt: null,
        email: fromEmail,
      },
      select: { id: true },
    })

    if (!patient) {
      return NextResponse.json({ success: true })
    }

    const body = text || stripHtml(html) || subject
    await logInboundCommunication({
      practiceId: integration.practiceId,
      patientId: patient.id,
      channel: 'email',
      body,
      subject: subject || undefined,
      metadata: {
        from: fromRaw,
        to: toRaw,
        providerMessageId: messageId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SENDGRID INBOUND] Error:', error)
    return NextResponse.json({ success: true })
  }
}
