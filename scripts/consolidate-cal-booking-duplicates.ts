/**
 * Remove duplicate CRM appointments caused by numeric Cal id vs UID mismatch.
 *
 *   npx tsx --env-file=.env.vercel.prod scripts/consolidate-cal-booking-duplicates.ts [practiceId]
 */
import { prisma } from '../src/lib/db'
import { consolidateCalBookingDuplicates } from '../src/lib/cal-booking-id'

const PRACTICE_ID =
  process.argv[2] || '9def9875-2d98-4f67-8745-d954ec02a9bb'

function isNumericCalBookingId(id: string) {
  return /^\d+$/.test(id)
}

function isUidCalBookingId(id: string) {
  return /[a-zA-Z]/.test(id)
}

async function main() {
  const appointments = await prisma.appointment.findMany({
    where: {
      practiceId: PRACTICE_ID,
      calBookingId: { not: null },
      NOT: { calBookingId: { startsWith: 'opendental:' } },
    },
    select: {
      id: true,
      calBookingId: true,
      patientId: true,
      startTime: true,
    },
    orderBy: { startTime: 'asc' },
  })

  const bySlot = new Map<string, typeof appointments>()
  for (const appt of appointments) {
    const key = `${appt.startTime.toISOString()}:${appt.patientId}`
    if (!bySlot.has(key)) bySlot.set(key, [])
    bySlot.get(key)!.push(appt)
  }

  let removed = 0
  for (const group of bySlot.values()) {
    if (group.length <= 1) continue

    const uid = group.find((a) => a.calBookingId && isUidCalBookingId(a.calBookingId))
      ?.calBookingId
    const numeric = group.find((a) => a.calBookingId && isNumericCalBookingId(a.calBookingId))
      ?.calBookingId

    if (!uid && !numeric) continue

    const result = await consolidateCalBookingDuplicates({
      practiceId: PRACTICE_ID,
      uid,
      id: numeric,
    })
    removed += result.removedIds.length
    if (result.removedIds.length > 0) {
      console.log(
        `Merged ${numeric ?? '?'} / ${uid ?? '?'} at ${group[0].startTime.toISOString()}: kept ${result.keptId}, removed ${result.removedIds.length}`
      )
    }
  }

  console.log(`Done. Removed ${removed} duplicate appointment row(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
