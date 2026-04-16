/**
 * Outbound staff notifications driven by Retell post-call analysis (e.g. unsuccessful transfers).
 * Uses per-practice PracticeSettings + Resend (sendgrid_integrations).
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSendgridClient } from '@/lib/sendgrid'
import { getRetellClient, type RetellCall } from '@/lib/retell-api'
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

/** Best-effort patient display name from Retell post-call custom analysis. */
function readPatientDisplayNameFromCall(call: RetellCall): string | null {
  const raw = call.call_analysis?.custom_analysis_data
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const norm = normalizeRetellRecord(raw as Record<string, unknown>)
  const direct = firstNonEmptyString(norm.patient_name, norm.name)
  if (direct) return direct
  const first = firstNonEmptyString(norm.patient_first_name)
  const last = firstNonEmptyString(norm.patient_last_name)
  const combined = `${first || ''} ${last || ''}`.trim()
  if (combined) return combined
  return firstNonEmptyString(norm.caller_name)
}

function formatCallDateTime(call: RetellCall): string {
  const ts = call.start_timestamp ?? call.end_timestamp
  if (ts == null || !Number.isFinite(ts)) return '—'
  try {
    return new Date(ts).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return '—'
  }
}

/** Public CRM origin for links in outbound email (never localhost in production). */
function getAppBaseUrlForEmailLinks(): string {
  const trim = (u: string | undefined) => u?.trim().replace(/\/$/, '') || ''

  const fromEnv =
    trim(process.env.NEXT_PUBLIC_APP_URL) ||
    trim(process.env.APP_BASE_URL) ||
    trim(process.env.NEXTAUTH_URL)
  if (fromEnv) return fromEnv

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`

  if (process.env.NODE_ENV === 'production') {
    return 'https://app.getvantage.tech'
  }
  return 'http://localhost:3000'
}

/**
 * Deep link to a call in the CRM for a specific practice (query param).
 * Staff sessions are scoped to `app.getvantage.tech`; `practiceId` lets Vantage admins
 * open the correct tenant after login and avoids ambiguous practice context.
 */
export function buildStaffCallLogDeepLink(callId: string, practiceId: string): string {
  const base = getAppBaseUrlForEmailLinks()
  const path = `/calls/${encodeURIComponent(callId)}`
  const qs = new URLSearchParams({ practiceId })
  return `${base}${path}?${qs.toString()}`
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

/** Notification inbox from Outbound Customer Notifications settings, else practice profile email. */
export async function resolveOutboundStaffNotificationRecipient(
  practiceId: string,
  settings: OutboundCustomerNotifications
): Promise<{ practiceName: string; recipient: string } | null> {
  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: { name: true, email: true },
  })
  const recipient =
    settings.recipientEmail?.trim() ||
    practice?.email?.trim() ||
    ''
  if (!recipient) return null
  return { practiceName: practice?.name ?? 'Practice', recipient }
}

function buildStaffTransferEmail(params: {
  practiceId: string
  practiceName: string
  call: RetellCall
}): { subject: string; textContent: string; htmlContent: string } {
  const { practiceId, practiceName, call } = params
  const callId = call.call_id || 'unknown'
  const { transferOutcome, voicemailMessage } = readRetellTransferNotificationFields(call)
  const patientName = readPatientDisplayNameFromCall(call)
  const callDatetime = formatCallDateTime(call)
  const callbackUrl = buildStaffCallLogDeepLink(callId, practiceId)

  const e = escapeHtml
  const outcomeDisplay = e(transferOutcome?.trim() || 'Not successful')
  const patientDisplay = e(patientName?.trim() || 'Unknown')
  const voicemailDisplay = voicemailMessage?.trim()
    ? e(voicemailMessage)
    : e('No voicemail message was captured.')

  const textContent = [
    `Missed Transfer Alert – ${practiceName}`,
    '',
    'A call transfer was attempted but not completed — action may be required.',
    '',
    `Practice: ${practiceName}`,
    `Status / outcome: ${transferOutcome?.trim() || 'Not successful'}`,
    `Date & time: ${callDatetime}`,
    `Patient name: ${patientName?.trim() || 'Unknown'}`,
    '',
    voicemailMessage?.trim()
      ? `Voicemail message:\n${voicemailMessage}`
      : 'Voicemail message: (none captured)',
    '',
    `Review full call log: ${callbackUrl}`,
    '',
    'Automated alert from your Vantage AI voice agent.',
  ].join('\n')

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Missed Transfer Alert – ${e(practiceName)}</title>
</head>
<body style="margin:0; padding:0; background-color:#0d0d0d; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; color:#0d0d0d;">
    A call transfer was attempted but not completed — action may be required.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#0d0d0d; padding:40px 16px;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px; width:100%; background-color:#141414; border-radius:12px; overflow:hidden; border:1px solid #2a2a2a;">

          <!-- HEADER -->
          <tr>
            <td style="padding:32px 40px 28px 40px; border-bottom:1px solid #222222;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td valign="middle">
                    <span style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:18px; font-weight:700; color:#f5f5f0; letter-spacing:-0.3px;">
                      \\ Vantage AI
                    </span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block; background-color:#2a1215; border:1px solid #5c1d24; color:#f87171; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; padding:5px 12px; border-radius:20px;">
                      ⚠&nbsp; Transfer Failed
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:36px 40px 32px 40px; border-bottom:1px solid #222222;">
              <p style="margin:0 0 8px 0; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#555555; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Voice Agent Notification</p>
              <h1 style="margin:0 0 12px 0; font-size:26px; font-weight:600; color:#f5f5f0; letter-spacing:-0.5px; line-height:1.2; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
                Call Transfer Unsuccessful
              </h1>
              <p style="margin:0; font-size:14px; color:#777777; line-height:1.6; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
                The voice agent attempted a transfer on behalf of a caller but was unable to complete it. Review the details below and follow up as needed.
              </p>
            </td>
          </tr>

          <!-- PRACTICE + STATUS -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background-color:#1a1a1a; border:1px solid #252525; border-radius:8px; padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="middle">
                          <p style="margin:0 0 3px 0; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:#555555; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Practice</p>
                          <p style="margin:0; font-size:17px; font-weight:600; color:#f5f5f0; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">${e(practiceName)}</p>
                        </td>
                        <td align="right" valign="middle">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="background-color:#1f1215; border:1px solid #3d1a1f; border-radius:6px; padding:8px 16px; text-align:center;">
                                <p style="margin:0 0 2px 0; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#555555; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Status</p>
                                <p style="margin:0; font-size:13px; font-weight:600; color:#f87171; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">${outcomeDisplay}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CALL DETAILS -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <p style="margin:0 0 14px 0; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#555555; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Call Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:12px 0; border-top:1px solid #1f1f1f;" width="150" valign="top">
                    <p style="margin:0; font-size:12px; color:#555555; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Date &amp; Time</p>
                  </td>
                  <td style="padding:12px 0; border-top:1px solid #1f1f1f;" valign="top">
                    <p style="margin:0; font-size:13px; color:#cccccc; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">${e(callDatetime)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0; border-top:1px solid #1f1f1f;" width="150" valign="top">
                    <p style="margin:0; font-size:12px; color:#555555; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Patient Name</p>
                  </td>
                  <td style="padding:12px 0; border-top:1px solid #1f1f1f;" valign="top">
                    <p style="margin:0; font-size:13px; color:#cccccc; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">${patientDisplay}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- VOICEMAIL MESSAGE -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <p style="margin:0 0 14px 0; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#555555; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Voicemail Message</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background-color:#111111; border:1px solid #222222; border-left:3px solid #3a3a3a; border-radius:0 8px 8px 0; padding:20px 24px;">
                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:14px;">
                      <tr>
                        <td>
                          <span style="display:inline-block; background-color:#1e1e1e; border:1px solid #2e2e2e; border-radius:20px; padding:4px 12px 4px 10px; font-size:11px; color:#777777; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing:0.5px;">
                            &#9654;&nbsp; Voicemail
                          </span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0; font-size:14px; line-height:1.75; color:#aaaaaa; font-family:'Georgia', 'Times New Roman', serif; font-style:italic;">
                      &#8220;${voicemailDisplay}&#8221;
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px 0 40px; text-align:center;">
              <a href="${callbackUrl}"
                 style="display:inline-block; background-color:#f5f5f0; color:#0d0d0d; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:13px; font-weight:600; letter-spacing:0.3px; text-decoration:none; padding:13px 32px; border-radius:6px;">
                Review Full Call Log &rarr;
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:32px 40px 36px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-top:1px solid #1f1f1f; padding-top:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="middle">
                          <p style="margin:0; font-size:11px; color:#333333; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; line-height:1.6;">
                            Automated alert from your Vantage AI voice agent.<br/>
                            If received in error, contact your system administrator.
                          </p>
                        </td>
                        <td align="right" valign="middle">
                          <p style="margin:0; font-size:11px; color:#2e2e2e; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing:0.5px;">
                            \\ Vantage AI
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`

  return {
    subject: `Missed Transfer Alert – ${practiceName}`,
    textContent,
    htmlContent,
  }
}

/**
 * Send the missed-transfer template using live Retell call data, labeled as a sample.
 * Does not require transfer outcome "not successful" and does not touch voice conversation dedupe metadata.
 */
export async function sendSampleMissedTransferNotification(params: {
  practiceId: string
  callId: string
}): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const { practiceId, callId } = params

  const settings = await loadOutboundCustomerNotifications(practiceId)
  if (!settings.notifyUnsuccessfulTransfer) {
    return {
      ok: false,
      error: 'Unsuccessful transfer notifications are disabled for this practice.',
    }
  }

  const resolved = await resolveOutboundStaffNotificationRecipient(practiceId, settings)
  if (!resolved) {
    return {
      ok: false,
      error:
        'No recipient email: set Notification inbox under Outbound Customer Notifications, or set the practice profile email.',
    }
  }

  try {
    const call = await (await getRetellClient(practiceId)).getCall(callId)
    const { subject, textContent, htmlContent } = buildStaffTransferEmail({
      practiceId,
      practiceName: resolved.practiceName,
      call,
    })

    const client = await getSendgridClient(practiceId)
    const result = await client.sendEmail({
      to: resolved.recipient,
      subject: `[Sample] ${subject}`,
      textContent: `[Manual sample — not sent by live automation rules]\n\n${textContent}`,
      htmlContent,
    })

    if (!result.success) {
      return { ok: false, error: result.error ?? 'Resend send failed' }
    }
    return { ok: true, messageId: result.messageId }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
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
    if (!settings.notifyUnsuccessfulTransfer) return

    const latest = await prisma.voiceConversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    })
    const meta = metadataObject(latest?.metadata)
    if (meta.unsuccessfulTransferEmailSentAt) return

    const resolved = await resolveOutboundStaffNotificationRecipient(practiceId, settings)
    if (!resolved) return

    const { practiceName, recipient } = resolved

    const { subject, textContent, htmlContent } = buildStaffTransferEmail({
      practiceId,
      practiceName,
      call,
    })

    const client = await getSendgridClient(practiceId)
    const result = await client.sendEmail({
      to: recipient,
      subject,
      textContent,
      htmlContent,
    })

    if (!result.success) {
      console.error('[outbound-customer-notifications] Resend failed', {
        practiceId,
        callId: call.call_id,
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
