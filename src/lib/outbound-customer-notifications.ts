/**
 * Outbound staff notifications driven by Retell post-call analysis (e.g. unsuccessful transfers).
 * Uses per-practice PracticeSettings + Resend (sendgrid_integrations).
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSendgridClient } from '@/lib/sendgrid'
import type { RetellCall } from '@/lib/retell-api'
import type { z } from 'zod'
import { outboundCustomerNotificationsSchema } from '@/lib/validations'

export type OutboundCustomerNotifications = z.infer<typeof outboundCustomerNotificationsSchema>

function normalizeRetellKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeRetellRecord(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    const normalized = normalizeRetellKey(key)
    if (!normalized) continue
    output[normalized] = value
  }
  return output
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text.length > 0) return text
  }
  return null
}

/**
 * Reads transfer outcome and voicemail message from Retell `custom_analysis_data`
 * using normalized keys (e.g. "Transfer Outcome" -> transfer_outcome).
 */
export function readRetellTransferNotificationFields(call: RetellCall): {
  transferOutcome: string | null
  voicemailMessage: string | null
} {
  const raw = call.call_analysis?.custom_analysis_data
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { transferOutcome: null, voicemailMessage: null }
  }
  const data = raw as Record<string, unknown>
  const norm = normalizeRetellRecord(data)

  return {
    transferOutcome: firstNonEmptyString(norm.transfer_outcome),
    voicemailMessage: firstNonEmptyString(norm.voicemail_message),
  }
}

/** True when Retell analysis reports transfer outcome "not successful" (case-insensitive, trimmed). */
export function isUnsuccessfulTransferFromRetellAnalysis(call: RetellCall): boolean {
  const { transferOutcome } = readRetellTransferNotificationFields(call)
  if (!transferOutcome) return false
  return transferOutcome.trim().toLowerCase() === 'not successful'
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseOutboundSettings(value: unknown): OutboundCustomerNotifications {
  const parsed = outboundCustomerNotificationsSchema.safeParse(value ?? {})
  if (!parsed.success) {
    return { recipientEmail: null, notifyUnsuccessfulTransfer: false }
  }
  return parsed.data
}

export async function loadOutboundCustomerNotifications(
  practiceId: string
): Promise<OutboundCustomerNotifications> {
  const row = await prisma.practiceSettings.findUnique({
    where: { practiceId },
    select: { outboundCustomerNotifications: true },
  })
  return parseOutboundSettings(row?.outboundCustomerNotifications)
}

export async function maybeNotifyUnsuccessfulTransfer(params: {
  practiceId: string
  call: RetellCall
  conversationId: string
}): Promise<void> {
  const { practiceId, call, conversationId } = params

  try {
    if (!isUnsuccessfulTransferFromRetellAnalysis(call)) return

    const settings = await loadOutboundCustomerNotifications(practiceId)
    const recipient = settings.recipientEmail?.trim()
    if (!settings.notifyUnsuccessfulTransfer || !recipient) return

    const latest = await prisma.voiceConversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    })
    const meta = metadataObject(latest?.metadata)
    if (meta.unsuccessfulTransferEmailSentAt) return

    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
      select: { name: true },
    })
    const practiceName = practice?.name ?? 'Practice'

    const { transferOutcome, voicemailMessage } = readRetellTransferNotificationFields(call)
    const callId = call.call_id || 'unknown'

    const lines: string[] = [
      `Practice: ${practiceName}`,
      `Retell call ID: ${callId}`,
      `Direction: ${call.direction ?? 'n/a'}`,
      `From: ${call.from_number ?? 'n/a'}`,
      `To: ${call.to_number ?? 'n/a'}`,
      `Transfer outcome: ${transferOutcome ?? 'n/a'}`,
    ]
    if (call.transfer_destination) {
      lines.push(`Transfer destination: ${call.transfer_destination}`)
    }
    if (call.disconnection_reason) {
      lines.push(`Disconnection reason: ${call.disconnection_reason}`)
    }
    if (voicemailMessage) {
      lines.push('')
      lines.push('Voicemail message (caller):')
      lines.push(voicemailMessage)
    }

    const textContent = [
      'A voice call transfer was not successful (per Retell post-call analysis).',
      '',
      ...lines,
      '',
      'This message was sent by Vantage CRM.',
    ].join('\n')

    const htmlLines = lines
      .map((line) => (line === '' ? '<br />' : `<p style="margin:0 0 8px 0;">${escapeHtml(line)}</p>`))
      .join('')

    const htmlContent = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin-top:0;">Unsuccessful call transfer</h2>
      <p>A voice agent attempted to transfer a call, but the outcome was <strong>not successful</strong>.</p>
      ${htmlLines}
      <p style="font-size:12px;color:#666;margin-top:24px;">This message was sent by Vantage CRM.</p>
    </body></html>`

    const client = await getSendgridClient(practiceId)
    const result = await client.sendEmail({
      to: recipient,
      subject: `[${practiceName}] Unsuccessful call transfer (${callId})`,
      textContent,
      htmlContent,
    })

    if (!result.success) {
      console.error('[outbound-customer-notifications] Resend failed', {
        practiceId,
        callId,
        error: result.error,
      })
      const afterFail = await prisma.voiceConversation.findUnique({
        where: { id: conversationId },
        select: { metadata: true },
      })
      const failMeta = metadataObject(afterFail?.metadata)
      await prisma.voiceConversation.update({
        where: { id: conversationId },
        data: {
          metadata: {
            ...failMeta,
            unsuccessfulTransferEmailFailedAt: new Date().toISOString(),
            unsuccessfulTransferEmailError: result.error ?? 'Unknown Resend error',
          } as Prisma.InputJsonObject,
        },
      })
      return
    }

    const afterSend = await prisma.voiceConversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    })
    const merged = metadataObject(afterSend?.metadata)
    await prisma.voiceConversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          ...merged,
          unsuccessfulTransferEmailSentAt: new Date().toISOString(),
          unsuccessfulTransferEmailMessageId: result.messageId ?? null,
          unsuccessfulTransferEmailError: null,
        } as Prisma.InputJsonObject,
      },
    })
  } catch (error) {
    console.error('[outbound-customer-notifications]', {
      practiceId,
      callId: call.call_id,
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
