import { prisma } from '@/lib/db'
import { replaceVariables } from '@/lib/marketing/variables'
import type { VariableContext } from '@/lib/marketing/types'
import {
  formatSlotDate,
  formatSlotTime,
  formatSlotDateTime,
} from '@/lib/appointment-optimization/formatSlotTimes'

const DEFAULT_SMS_TEMPLATE =
  'Hi {{patient.firstName}} — an earlier {{offeredSlot.visitType}} appointment opened on {{offeredSlot.date}} at {{offeredSlot.time}}. You are currently scheduled for {{appointment.currentDate}} at {{appointment.currentTime}}. Reply YES to move to the earlier time, or visit {{links.portalAppointments}}.'

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
  visitType?: string
  currentAppointmentStart?: Date
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
  const offeredDate = formatSlotDate(params.slotStart, params.timezone)
  const offeredTime = formatSlotTime(params.slotStart, params.timezone)

  const context: VariableContext = {
    patient: {
      firstName: params.patientFirstName,
    },
    appointment: {
      date: offeredDate,
      time: offeredTime,
      providerName: params.providerName,
      currentDate: params.currentAppointmentStart
        ? formatSlotDate(params.currentAppointmentStart, params.timezone)
        : '',
      currentTime: params.currentAppointmentStart
        ? formatSlotTime(params.currentAppointmentStart, params.timezone)
        : '',
    },
    offeredSlot: {
      date: offeredDate,
      time: offeredTime,
      dateTime: formatSlotDateTime(params.slotStart, params.timezone),
      visitType: params.visitType || '',
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
