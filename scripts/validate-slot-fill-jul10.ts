/**
 * Validate slot-fill pipeline for a Jul 10 cancel → Jul 14 patient scenario.
 *
 *   PRACTICE_ID=... npx tsx scripts/validate-slot-fill-jul10.ts
 */
import { prisma } from '../src/lib/db'
import { findEligibleCandidates } from '../src/lib/appointment-optimization/candidates'
import {
  getOutboundAgentsSettings,
  getSlotFillRuleForVisitType,
  hasActiveSlotFillRules,
  isAppointmentOptimizationEnabled,
  isTriggerScenarioEnabled,
} from '../src/lib/appointment-optimization/settings'
import { getLookAheadWindow, isWithinBufferWindow } from '../src/lib/business-days'
import { getPracticeTimeZone } from '../src/lib/practice-timezone'

const PRACTICE_ID = process.env.PRACTICE_ID ?? '9def9875-2d98-4f67-8745-d954ec02a9bb'

async function main() {
  const practice = await prisma.practice.findUnique({
    where: { id: PRACTICE_ID },
    select: { id: true, name: true },
  })
  if (!practice) throw new Error(`Practice not found: ${PRACTICE_ID}`)

  const settings = await getOutboundAgentsSettings(PRACTICE_ID)
  const tz = await getPracticeTimeZone(PRACTICE_ID)
  const now = new Date()

  console.log('=== PRACTICE ===')
  console.log(practice.name, practice.id)
  console.log('Timezone:', tz)
  console.log('Now (UTC):', now.toISOString())

  console.log('\n=== OUTBOUND SETTINGS ===')
  console.log({
    agentOn: isAppointmentOptimizationEnabled(settings),
    cancellationTrigger: isTriggerScenarioEnabled(settings, 'cancellation'),
    hasActiveRules: hasActiveSlotFillRules(settings),
    slotFillRules: settings.slotFillRules,
    smsTemplateName: settings.smsTemplateName,
  })

  const jul10Start = new Date('2026-07-10T00:00:00.000Z')
  const jul11Start = new Date('2026-07-11T00:00:00.000Z')
  const jul14Start = new Date('2026-07-14T00:00:00.000Z')
  const jul15Start = new Date('2026-07-15T00:00:00.000Z')

  const cancelledJul10 = await prisma.appointment.findMany({
    where: {
      practiceId: PRACTICE_ID,
      status: 'cancelled',
      startTime: { gte: jul10Start, lt: jul11Start },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      visitType: true,
      providerId: true,
      startTime: true,
      endTime: true,
      updatedAt: true,
      patient: { select: { id: true, name: true } },
    },
  })

  const recentCancelled = await prisma.appointment.findMany({
    where: {
      practiceId: PRACTICE_ID,
      status: 'cancelled',
      startTime: { gte: new Date('2026-07-01'), lt: new Date('2026-07-20') },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      visitType: true,
      startTime: true,
      updatedAt: true,
      patient: { select: { name: true } },
    },
  })

  const scheduledJul14 = await prisma.appointment.findMany({
    where: {
      practiceId: PRACTICE_ID,
      status: { in: ['scheduled', 'confirmed'] },
      startTime: { gte: jul14Start, lt: jul15Start },
    },
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      visitType: true,
      providerId: true,
      startTime: true,
      endTime: true,
      patient: { select: { id: true, name: true, phone: true, primaryPhone: true } },
    },
  })

  const openSlotsJul10 = await prisma.openSlotEvent.findMany({
    where: {
      practiceId: PRACTICE_ID,
      slotStart: { gte: jul10Start, lt: jul11Start },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      attempts: { include: { patient: { select: { name: true } } } },
    },
  })

  const inventoryJul10 = await prisma.openSlotInventory.findMany({
    where: {
      practiceId: PRACTICE_ID,
      slotStart: { gte: jul10Start, lt: jul11Start },
    },
    orderBy: { createdAt: 'desc' },
  })

  const recentAppts = await prisma.appointment.findMany({
    where: { practiceId: PRACTICE_ID, updatedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      visitType: true,
      startTime: true,
      updatedAt: true,
      patient: { select: { name: true } },
    },
  })

  console.log('\n=== CANCELLED ON JUL 10 ===')
  console.log(cancelledJul10.length ? cancelledJul10 : 'None')

  console.log('\n=== ALL CANCELLED JUL 2026 ===')
  console.log(recentCancelled.length ? recentCancelled : 'None')

  console.log('\n=== SCHEDULED ON JUL 14 ===')
  console.log(scheduledJul14.length ? scheduledJul14 : 'None')

  console.log('\n=== OPEN SLOT EVENTS JUL 10 ===')
  console.log(openSlotsJul10.length ? openSlotsJul10 : 'None')

  console.log('\n=== INVENTORY JUL 10 ===')
  console.log(inventoryJul10.length ? inventoryJul10 : 'None')

  console.log('\n=== APPOINTMENTS UPDATED LAST 2H ===')
  console.log(recentAppts.length ? recentAppts : 'None')

  console.log('\n=== VERDICT ===')
  const rule = settings.slotFillRules?.[0]
  if (!rule) {
    console.log('FAIL: No active slot fill rule')
    return
  }

  // Simulate Jul 10 9:30 AM Chicago = 14:30 UTC (CDT is UTC-5 in July)
  const simulatedSlotStart = new Date('2026-07-10T14:30:00.000Z')
  const simulatedSlotEnd = new Date('2026-07-10T15:00:00.000Z')
  const inBuffer = isWithinBufferWindow(simulatedSlotStart, rule.bufferBusinessDays, tz, now)
  const { lookAheadStart, lookAheadEnd } = getLookAheadWindow(
    simulatedSlotStart,
    rule.lookAheadStartBusinessDays,
    rule.lookAheadEndBusinessDays,
    tz
  )

  console.log({
    simulatedSlot: simulatedSlotStart.toISOString(),
    bufferBusinessDays: rule.bufferBusinessDays,
    inBufferNow: inBuffer,
    lookAheadStart: lookAheadStart.toISOString(),
    lookAheadEnd: lookAheadEnd.toISOString(),
    jul14WithinLookAhead: scheduledJul14.every(
      (a) => a.startTime >= lookAheadStart && a.startTime <= lookAheadEnd
    ),
  })

  if (!inBuffer) {
    console.log(
      `BLOCKED: Jul 10 slot is outside the ${rule.bufferBusinessDays}-business-day buffer from today. Mira would NOT start outreach until the slot enters the buffer window (or increase buffer in settings).`
    )
  }

  if (inBuffer) {
    const candidates = await findEligibleCandidates({
      practiceId: PRACTICE_ID,
      providerId: null,
      appointmentType: rule.visitType,
      slotStart: simulatedSlotStart,
      slotEnd: simulatedSlotEnd,
      durationMinutes: 30,
      openSlotEventId: 'validation-simulation',
      waveNumber: 1,
      lookAheadStart,
      lookAheadEnd,
    })
    console.log('Eligible candidates (simulated Jul 10 open slot):', candidates)
    if (candidates.length === 0) {
      console.log('BLOCKED: No eligible Jul 14 candidates matched (visit type, provider, phone, opt-in, duration).')
    } else {
      console.log('PASS: Mira WOULD offer Jul 10 slot to these patients.')
    }
  }

  if (cancelledJul10.length === 0 && openSlotsJul10.length === 0) {
    console.log(
      '\nNOTE: No Jul 10 cancel or open slot found in DB. Either the cancel did not persist, used a different date/time, or slot-fill handler did not run.'
    )
  }

  if (openSlotsJul10.length > 0) {
    for (const slot of openSlotsJul10) {
      const meta = slot.metadata as { lookAheadStart?: string; lookAheadEnd?: string } | null
      const laStart = meta?.lookAheadStart ? new Date(meta.lookAheadStart) : lookAheadStart
      const laEnd = meta?.lookAheadEnd ? new Date(meta.lookAheadEnd) : lookAheadEnd
      const candidates = await findEligibleCandidates({
        practiceId: PRACTICE_ID,
        providerId: slot.providerId,
        appointmentType: slot.appointmentType,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        durationMinutes: slot.durationMinutes,
        openSlotEventId: slot.id,
        waveNumber: 99,
        lookAheadStart: laStart,
        lookAheadEnd: laEnd,
      })
      console.log(`Actual open slot ${slot.id}: status=${slot.status}, attempts=${slot.attempts.length}, eligible=${candidates.length}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
