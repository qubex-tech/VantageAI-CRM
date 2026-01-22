import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'

const UPCOMING_WINDOW_HOURS = 48
const SCHEDULE_CRON = '*/15 * * * *'

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

function buildAppointmentReminderPayload(appointment: {
  id: string
  practiceId: string
  patientId: string
  startTime: Date | string
  endTime: Date | string
  status: string
  visitType: string
  timezone: string
  patient: any
}) {
  const now = new Date()
  const startTime = toDate(appointment.startTime)
  const endTime = toDate(appointment.endTime)
  const minutesUntilStart = Math.round(
    (startTime.getTime() - now.getTime()) / (1000 * 60)
  )
  const hoursUntilStart = Math.round(minutesUntilStart / 60)
  const daysUntilStart = Math.round(hoursUntilStart / 24)

  return {
    appointment: {
      id: appointment.id,
      patientId: appointment.patientId,
      status: appointment.status,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      visitType: appointment.visitType,
      timezone: appointment.timezone,
      minutesUntilStart,
      hoursUntilStart,
      daysUntilStart,
    },
    patient: appointment.patient,
  }
}

/**
 * Scheduled function to emit upcoming appointment events
 * Enables workflows like "send reminders when appointment is less than X time away"
 */
export const emitUpcomingAppointmentEvents = inngest.createFunction(
  {
    id: 'emit-upcoming-appointment-events',
    name: 'Emit Upcoming Appointment Events',
  },
  { cron: SCHEDULE_CRON },
  async ({ step }) => {
    const now = new Date()
    const windowEnd = new Date(now.getTime() + UPCOMING_WINDOW_HOURS * 60 * 60 * 1000)

    const appointments = await step.run('fetch-upcoming-appointments', async () => {
      return prisma.appointment.findMany({
        where: {
          startTime: {
            gte: now,
            lte: windowEnd,
          },
          status: {
            in: ['scheduled', 'confirmed'],
          },
        },
        include: {
          patient: true,
        },
      })
    })

    if (appointments.length === 0) {
      return { emitted: 0 }
    }

    await step.run('emit-upcoming-events', async () => {
      for (const appointment of appointments) {
        await emitEvent({
          practiceId: appointment.practiceId,
          eventName: 'crm/appointment.upcoming',
          entityType: 'appointment',
          entityId: appointment.id,
          data: buildAppointmentReminderPayload(appointment),
        })
      }
    })

    return { emitted: appointments.length }
  }
)
