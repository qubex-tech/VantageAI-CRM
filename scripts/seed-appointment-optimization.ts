/**
 * Seed sample data for Appointment Optimization dashboard (dev only).
 *
 *   npx tsx scripts/seed-appointment-optimization.ts
 *   PRACTICE_ID=... npx tsx scripts/seed-appointment-optimization.ts
 */
import { prisma } from '../src/lib/db'

const PRACTICE_ID = process.env.PRACTICE_ID

async function main() {
  const practice = PRACTICE_ID
    ? await prisma.practice.findUnique({ where: { id: PRACTICE_ID } })
    : await prisma.practice.findFirst()
  if (!practice) throw new Error('No practice found')

  await prisma.practiceSettings.upsert({
    where: { practiceId: practice.id },
    create: {
      practiceId: practice.id,
      outboundAgents: {
        masterEnabled: true,
        insuranceVerificationEnabled: false,
        appointmentOptimizationEnabled: true,
        outreachChannel: 'sms',
        smsTemplateName: 'Earlier Appointment Available',
        triggerScenarios: {
          cancellation: true,
          noShow: false,
          reschedule: false,
          availability: false,
        },
      },
    },
    update: {
      outboundAgents: {
        masterEnabled: true,
        insuranceVerificationEnabled: false,
        appointmentOptimizationEnabled: true,
        outreachChannel: 'sms',
        smsTemplateName: 'Earlier Appointment Available',
        triggerScenarios: {
          cancellation: true,
          noShow: false,
          reschedule: false,
          availability: false,
        },
      },
    },
  })

  const slotStart = new Date()
  slotStart.setDate(slotStart.getDate() + 3)
  slotStart.setHours(10, 0, 0, 0)
  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)

  const openSlot = await prisma.openSlotEvent.create({
    data: {
      practiceId: practice.id,
      providerId: 'Practitioner/demo',
      appointmentType: 'Follow-up',
      slotStart,
      slotEnd,
      durationMinutes: 30,
      source: 'cancellation',
      idempotencyKey: `seed:${Date.now()}`,
      status: 'open',
      wavesSent: 1,
      patientsContacted: 2,
    },
  })

  await prisma.slotWave.create({
    data: {
      practiceId: practice.id,
      openSlotEventId: openSlot.id,
      waveNumber: 1,
      status: 'completed',
      patientsTargeted: 2,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  })

  console.log('Seeded appointment optimization for practice', practice.id)
  console.log('Open slot event', openSlot.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
