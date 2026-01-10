import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding test notes to patient-1...')

  // Find the admin user to use as note creator
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@demopractice.com' },
  })

  if (!admin) {
    console.error('Admin user not found. Please run seed script first.')
    process.exit(1)
  }

  // Create some test notes for patient-1
  const notes = [
    {
      patientId: 'patient-1',
      practiceId: 'demo-practice-1',
      userId: admin.id,
      type: 'contact',
      content: '[Automation Email] Sent to nasir.saqib1@gmail.com (Subject: Appointment Scheduled, MessageId: Fsm_ew9zSjCMtMYasRoiMA): Thank you for scheduling your appointment! Make sure you remember to bring your insurance card.',
    },
    {
      patientId: 'patient-1',
      practiceId: 'demo-practice-1',
      userId: admin.id,
      type: 'contact',
      content: '[Automation Email] Sent to nasir.saqib1@gmail.com (Subject: Missing Information, MessageId: gObSdEtRQKe5JmWEz81W5w): Can you please share your insurance information.',
    },
    {
      patientId: 'patient-1',
      practiceId: 'demo-practice-1',
      userId: admin.id,
      type: 'general',
      content: 'Missing Insurance Info',
    },
  ]

  // Check if notes already exist for this patient
  const existingNotes = await prisma.patientNote.findMany({
    where: { patientId: 'patient-1' },
  })

  if (existingNotes.length > 0) {
    console.log(`⚠️  Patient already has ${existingNotes.length} notes. Skipping creation.`)
    console.log('To recreate notes, delete existing ones first.')
    return
  }

  // Create notes with different timestamps
  for (let i = 0; i < notes.length; i++) {
    const noteData = notes[i]
    // Space them out over time (most recent first)
    const daysAgo = notes.length - 1 - i
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - daysAgo)
    createdAt.setHours(11 - daysAgo, 55 - daysAgo * 2, 0, 0)

    const note = await prisma.patientNote.create({
      data: {
        ...noteData,
        createdAt,
      },
    })
    console.log(`✅ Created note: ${note.type} (${createdAt.toLocaleDateString()})`)
  }

  console.log(`\n✅ Created ${notes.length} test notes`)

  console.log('\n✅ Test notes added successfully!')
  console.log('Visit http://localhost:3000/patients/patient-1 to see the notes in the sidebar.')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
