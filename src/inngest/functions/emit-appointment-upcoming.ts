import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import {
  APPOINTMENT_UPCOMING_EVENT,
  calendarDaysUntil,
  extractUpcomingEmitConfig,
  shouldEmitUpcomingForDaysUntil,
  upcomingEmitKey,
  type UpcomingEmitConfig,
} from '@/automations/appointment-upcoming'

const SCHEDULE_CRON = '*/15 * * * *'

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

function buildAppointmentReminderPayload(
  appointment: {
    id: string
    practiceId: string
    patientId: string
    startTime: Date | string
    endTime: Date | string
    status: string
    visitType: string
    timezone: string
    patient: any
  },
  daysUntilStart: number
) {
  const now = new Date()
  const startTime = toDate(appointment.startTime)
  const endTime = toDate(appointment.endTime)
  const minutesUntilStart = Math.round((startTime.getTime() - now.getTime()) / (1000 * 60))
  const hoursUntilStart = Math.round(minutesUntilStart / 60)

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

function daysUntilFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const rec = payload as {
    entityId?: unknown
    data?: { appointment?: { daysUntilStart?: unknown } }
  }
  const days = rec.data?.appointment?.daysUntilStart
  return typeof days === 'number' && Number.isFinite(days) ? days : null
}

function entityIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const entityId = (payload as { entityId?: unknown }).entityId
  return typeof entityId === 'string' && entityId.trim() ? entityId : null
}

/**
 * Scheduled function to emit upcoming appointment events.
 * Look-ahead comes from enabled automations (days before / eligibility),
 * and each appointment emits at most once per calendar-days-until value.
 */
export const emitUpcomingAppointmentEvents = inngest.createFunction(
  {
    id: 'emit-upcoming-appointment-events',
    name: 'Emit Upcoming Appointment Events',
  },
  { cron: SCHEDULE_CRON },
  async ({ step }) => {
    const practices = await step.run('load-practices-with-upcoming-rules', async () => {
      const rules = await prisma.automationRule.findMany({
        where: {
          enabled: true,
          triggerEvent: APPOINTMENT_UPCOMING_EVENT,
        },
        select: {
          practiceId: true,
          conditionsJson: true,
          actionsJson: true,
        },
      })

      const byPractice = new Map<string, typeof rules>()
      for (const rule of rules) {
        const list = byPractice.get(rule.practiceId) ?? []
        list.push(rule)
        byPractice.set(rule.practiceId, list)
      }

      return [...byPractice.entries()].map(([practiceId, practiceRules]) => ({
        practiceId,
        config: extractUpcomingEmitConfig(practiceRules),
      }))
    })

    if (practices.length === 0) {
      return { emitted: 0, skipped: true, reason: 'no_enabled_automations' }
    }

    const now = new Date()
    let emitted = 0
    let skippedAlreadyEmitted = 0
    let skippedOutsideWindow = 0

    for (const practice of practices) {
      const result = await step.run(`emit-upcoming-${practice.practiceId}`, async () => {
        const timeZone = await getPracticeTimeZone(practice.practiceId)
        const windowEnd = new Date(now.getTime() + practice.config.windowDays * 24 * 60 * 60 * 1000)
        const lookback = new Date(now.getTime() - 36 * 60 * 60 * 1000)

        const [appointments, recentEvents] = await Promise.all([
          prisma.appointment.findMany({
            where: {
              practiceId: practice.practiceId,
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
          }),
          prisma.outboxEvent.findMany({
            where: {
              practiceId: practice.practiceId,
              name: APPOINTMENT_UPCOMING_EVENT,
              createdAt: { gte: lookback },
            },
            select: { payload: true },
          }),
        ])

        const alreadyEmitted = new Set<string>()
        for (const event of recentEvents) {
          const appointmentId = entityIdFromPayload(event.payload)
          const daysUntil = daysUntilFromPayload(event.payload)
          if (appointmentId != null && daysUntil != null) {
            alreadyEmitted.add(upcomingEmitKey(appointmentId, daysUntil))
          }
        }

        let practiceEmitted = 0
        let practiceSkippedEmitted = 0
        let practiceSkippedWindow = 0

        for (const appointment of appointments) {
          const daysUntilStart = calendarDaysUntil(toDate(appointment.startTime), now, timeZone)
          if (!shouldEmitUpcomingForDaysUntil(daysUntilStart, practice.config as UpcomingEmitConfig)) {
            practiceSkippedWindow += 1
            continue
          }

          const emitKey = upcomingEmitKey(appointment.id, daysUntilStart)
          if (alreadyEmitted.has(emitKey)) {
            practiceSkippedEmitted += 1
            continue
          }

          await emitEvent({
            practiceId: appointment.practiceId,
            eventName: APPOINTMENT_UPCOMING_EVENT,
            entityType: 'appointment',
            entityId: appointment.id,
            data: buildAppointmentReminderPayload(appointment, daysUntilStart),
          })
          alreadyEmitted.add(emitKey)
          practiceEmitted += 1
        }

        return {
          practiceEmitted,
          practiceSkippedEmitted,
          practiceSkippedWindow,
        }
      })

      emitted += result.practiceEmitted
      skippedAlreadyEmitted += result.practiceSkippedEmitted
      skippedOutsideWindow += result.practiceSkippedWindow
    }

    return {
      emitted,
      skippedAlreadyEmitted,
      skippedOutsideWindow,
      practiceCount: practices.length,
    }
  }
)
