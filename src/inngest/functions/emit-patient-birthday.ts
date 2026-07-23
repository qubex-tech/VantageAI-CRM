import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { emitEvent } from '@/lib/outbox'
import {
  BIRTHDAY_EMIT_HOUR,
  DEFAULT_PRACTICE_TIMEZONE,
  PATIENT_BIRTHDAY_EVENT,
  buildPatientBirthdayPayload,
  getBirthdayMatchTargets,
  getZonedDateParts,
  isBirthdayEmitHour,
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
 * Hourly cron that emits crm/patient.birthday once per patient per year
 * when practice-local time is 09:00–09:59 and DOB month/day matches today.
 */
export const emitPatientBirthdayEvents = inngest.createFunction(
  {
    id: 'emit-patient-birthday-events',
    name: 'Emit Patient Birthday Events',
  },
  { cron: SCHEDULE_CRON },
  async ({ step }) => {
    const now = new Date()

    const practices = await step.run('load-practices', async () => {
      return prisma.practice.findMany({
        select: {
          id: true,
          brandProfile: {
            select: {
              timezone: true,
            },
          },
        },
      })
    })

    let emitted = 0
    let skippedOutsideWindow = 0
    let skippedAlreadyEmitted = 0

    for (const practice of practices) {
      const timezone = practice.brandProfile?.timezone || DEFAULT_PRACTICE_TIMEZONE
      const local = getZonedDateParts(now, timezone)

      if (!isBirthdayEmitHour(local.hour)) {
        skippedOutsideWindow += 1
        continue
      }

      const result = await step.run(`emit-birthdays-${practice.id}`, async () => {
        const targets = getBirthdayMatchTargets(local.month, local.day, local.year)
        const patients = await findBirthdayPatients(practice.id, targets)

        let practiceEmitted = 0
        let practiceSkipped = 0

        for (const patient of patients) {
          const dateOfBirth =
            patient.dateOfBirth instanceof Date
              ? patient.dateOfBirth
              : new Date(patient.dateOfBirth)

          if (Number.isNaN(dateOfBirth.getTime())) continue

          if (await alreadyEmittedThisYear(practice.id, patient.id, local.year)) {
            practiceSkipped += 1
            continue
          }

          await emitEvent({
            practiceId: practice.id,
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
      emitHour: BIRTHDAY_EMIT_HOUR,
      practicesChecked: practices.length,
      practicesOutsideWindow: skippedOutsideWindow,
      emitted,
      skippedAlreadyEmitted,
    }
  }
)
