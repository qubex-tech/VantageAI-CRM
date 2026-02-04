import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logInboundCommunication } from '@/lib/communications/logging'

function extractEmails(value?: string | null) {
  if (!value) return []
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
  return matches ? matches.map((email) => email.toLowerCase().trim()) : []
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim()
}

function stripPlusTag(email: string) {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const cleanLocal = local.split('+')[0]
  return `${cleanLocal}@${domain}`
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
    const envelopeRaw = (form.get('envelope') as string) || ''

    const fromEmails = extractEmails(fromRaw)
    const toEmails = extractEmails(toRaw)
    let envelopeTo: string[] = []
    let envelopeFrom: string[] = []
    try {
      if (envelopeRaw) {
        const parsed = JSON.parse(envelopeRaw)
        envelopeTo = extractEmails(parsed?.to?.join?.(',') || parsed?.to)
        envelopeFrom = extractEmails(parsed?.from)
      }
    } catch {
      // ignore envelope parse errors
    }

    const allTo = Array.from(new Set([...toEmails, ...envelopeTo].map(normalizeEmail)))
    const allFrom = Array.from(new Set([...fromEmails, ...envelopeFrom].map(normalizeEmail)))

    if (allTo.length === 0 || allFrom.length === 0) {
      return NextResponse.json({ success: true })
    }
    const normalizedToCandidates = Array.from(
      new Set(allTo.flatMap((email) => [email, stripPlusTag(email)]))
    )
    const normalizedFromCandidates = Array.from(
      new Set(allFrom.flatMap((email) => [email, stripPlusTag(email)]))
    )

    const integration = await prisma.sendgridIntegration.findFirst({
      where: {
        fromEmail: { in: normalizedToCandidates },
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
        email: { in: normalizedFromCandidates },
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
        from: normalizedFromCandidates[0],
        to: normalizedToCandidates[0],
        providerMessageId: messageId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SENDGRID INBOUND] Error:', error)
    return NextResponse.json({ success: true })
  }
}
