import { prisma } from '@/lib/db'
import { replaceVariables } from '@/lib/marketing/variables'
import type { VariableContext } from '@/lib/marketing/types'
const DEFAULT_SMS_TEMPLATE =
  'Hi {{patient.firstName}} — an earlier appointment just opened with {{appointment.providerName}} on {{appointment.date}} at {{appointment.time}}. You can move your visit here: {{links.portalAppointments}}. This slot is first come, first served.'

function getPortalAppointmentsUrl() {
  const base = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  return base ? `${base}/portal/appointments` : 'https://portal.getvantage.tech/portal/appointments'
}

export async function resolveEarlierSlotSmsBody(params: {
  practiceId: string
  templateName?: string
  patientFirstName: string
  providerName: string
  slotStart: Date
  timezone: string
}) {
  const template = await prisma.marketingTemplate.findFirst({
    where: {
      tenantId: params.practiceId,
      channel: 'sms',
      name: params.templateName || 'Earlier Appointment Available',
      status: 'published',
    },
    select: { bodyText: true },
  })

  const bodyTemplate = template?.bodyText?.trim() || DEFAULT_SMS_TEMPLATE
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: params.timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(params.slotStart)
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: params.timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(params.slotStart)

  const context: VariableContext = {
    patient: {
      firstName: params.patientFirstName,
    },
    appointment: {
      date: dateStr,
      time: timeStr,
      providerName: params.providerName,
    },
    links: {
      portalAppointments: getPortalAppointmentsUrl(),
      reschedule: getPortalAppointmentsUrl(),
    },
    practice: {
      name: '',
    },
  }

  return replaceVariables(bodyTemplate, context)
}

export function formatProviderDisplayName(providerId: string | null, fallback = 'your provider') {
  if (!providerId) return fallback
  const stripped = providerId.replace(/^Practitioner\//, '')
  if (stripped.length > 24) return 'your care team'
  return fallback
}
