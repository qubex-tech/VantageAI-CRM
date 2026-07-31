import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import {
  PATIENT_BIRTHDAY_EVENT,
  buildPatientBirthdayPayload,
  extractBirthdayEmitHoursFromActions,
  getBirthdayMatchTargets,
  getZonedDateParts,
  shouldEmitBirthdaysAtLocalHour,
} from '@/automations/patient-birthday'

const SCHEDULE_CRON = '0 * * * *'

type BirthdayPatientRow = {
  id: string
  practiceId: string
  name: string
  firstName: string | null
  lastName: string | null
  preferredName: string | null
  email: string | null
  phone: string
  primaryPhone: string | null
  secondaryPhone: string | null
  preferredContactMethod: string
  dateOfBirth: Date
}

async function findBirthdayPatients(
  practiceId: string,
  targets: Array<{ month: number; day: number }>
): Promise<BirthdayPatientRow[]> {
  if (targets.length === 0) return []

  const monthDayPairs = targets.flatMap((t) => [t.month, t.day])
  const pairPlaceholders = targets
    .map((_, i) => `($${i * 2 + 2}::int, $${i * 2 + 3}::int)`)
    .join(', ')

  return prisma.$queryRawUnsafe<BirthdayPatientRow[]>(
    `
      SELECT
        id,
        "practiceId",
        name,
        "firstName",
        "lastName",
        "preferredName",
        email,
        phone,
        "primaryPhone",
        "secondaryPhone",
        "preferredContactMethod",
        "dateOfBirth"
      FROM patients
      WHERE "practiceId" = $1
        AND "deletedAt" IS NULL
        AND "dateOfBirth" IS NOT NULL
        AND (
          EXTRACT(MONTH FROM ("dateOfBirth" AT TIME ZONE 'UTC'))::int,
          EXTRACT(DAY FROM ("dateOfBirth" AT TIME ZONE 'UTC'))::int
        ) IN (${pairPlaceholders})
    `,
    practiceId,
    ...monthDayPairs
  )
}

async function alreadyEmittedThisYear(
  practiceId: string,
  patientId: string,
  year: number
): Promise<boolean> {
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1))

  const existing = await prisma.outboxEvent.findFirst({
    where: {
      practiceId,
      name: PATIENT_BIRTHDAY_EVENT,
      createdAt: {
        gte: yearStart,
        lt: yearEnd,
      },
      payload: {
        path: ['entityId'],
        equals: patientId,
      },
    },
    select: { id: true },
  })

  return Boolean(existing)
}

/**
 * Hourly cron that emits crm/patient.birthday once per patient per year when
 * practice-local hour matches a birthday automation's send-window start hour
 * (or wait_until_local_time hour), and DOB month/day matches today.
 */
export const emitPatientBirthdayEvents = inngest.createFunction(
  {
    id: 'emit-patient-birthday-events',
    name: 'Emit Patient Birthday Events',
  },
  { cron: SCHEDULE_CRON },
  async ({ step }) => {
    const now = new Date()

    const practices = await step.run('load-practices-with-birthday-rules', async () => {
      const rules = await prisma.automationRule.findMany({
        where: {
          enabled: true,
          triggerEvent: PATIENT_BIRTHDAY_EVENT,
        },
        select: {
          practiceId: true,
          actionsJson: true,
        },
      })

      const emitHoursByPractice = new Map<string, Set<number>>()
      for (const rule of rules) {
        const hours = extractBirthdayEmitHoursFromActions(rule.actionsJson)
        if (hours.length === 0) continue
        const existing = emitHoursByPractice.get(rule.practiceId) ?? new Set<number>()
        for (const hour of hours) existing.add(hour)
        emitHoursByPractice.set(rule.practiceId, existing)
      }

      return [...emitHoursByPractice.entries()].map(([practiceId, hours]) => ({
        practiceId,
        emitHours: [...hours].sort((a, b) => a - b),
      }))
    })

    let emitted = 0
    let skippedOutsideWindow = 0
    let skippedNoEmitHours = 0
    let skippedAlreadyEmitted = 0

    for (const practice of practices) {
      if (practice.emitHours.length === 0) {
        skippedNoEmitHours += 1
        continue
      }

      const timezone = await step.run(`timezone-${practice.practiceId}`, async () => {
        return getPracticeTimeZone(practice.practiceId)
      })
      const local = getZonedDateParts(now, timezone)

      if (!shouldEmitBirthdaysAtLocalHour(local.hour, practice.emitHours)) {
        skippedOutsideWindow += 1
        continue
      }

      const result = await step.run(`emit-birthdays-${practice.practiceId}`, async () => {
        const targets = getBirthdayMatchTargets(local.month, local.day, local.year)
        const patients = await findBirthdayPatients(practice.practiceId, targets)

        let practiceEmitted = 0
        let practiceSkipped = 0

        for (const patient of patients) {
          const dateOfBirth =
            patient.dateOfBirth instanceof Date
              ? patient.dateOfBirth
              : new Date(patient.dateOfBirth)

          if (Number.isNaN(dateOfBirth.getTime())) continue

          if (await alreadyEmittedThisYear(practice.practiceId, patient.id, local.year)) {
            practiceSkipped += 1
            continue
          }

          await emitEvent({
            practiceId: practice.practiceId,
            eventName: PATIENT_BIRTHDAY_EVENT,
            entityType: 'patient',
            entityId: patient.id,
            data: buildPatientBirthdayPayload(
              { ...patient, dateOfBirth },
              {
                year: local.year,
                month: local.month,
                day: local.day,
              }
            ),
          })
          practiceEmitted += 1
        }

        return { practiceEmitted, practiceSkipped, candidateCount: patients.length }
      })

      emitted += result.practiceEmitted
      skippedAlreadyEmitted += result.practiceSkipped
    }

    return {
      practicesChecked: practices.length,
      practicesOutsideWindow: skippedOutsideWindow,
      practicesMissingEmitHours: skippedNoEmitHours,
      emitted,
      skippedAlreadyEmitted,
    }
  }
)
