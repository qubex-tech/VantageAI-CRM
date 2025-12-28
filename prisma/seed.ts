import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create a practice
  const practice = await prisma.practice.upsert({
    where: { id: 'demo-practice-1' },
    update: {},
    create: {
      id: 'demo-practice-1',
      name: 'Demo Medical Practice',
      email: 'admin@demopractice.com',
      phone: '+1-555-0100',
      address: '123 Medical Center Dr, City, State 12345',
    },
  })

  console.log('Created practice:', practice.name)

  // Create admin user
  const passwordHash = await bcrypt.hash('demo123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demopractice.com' },
    update: {},
    create: {
      email: 'admin@demopractice.com',
      passwordHash,
      name: 'Admin User',
      role: 'admin',
      practiceId: practice.id,
    },
  })

  console.log('Created admin user:', admin.email, '(password: demo123)')

  // Create sample patients
  const patient1 = await prisma.patient.upsert({
    where: { id: 'patient-1' },
    update: {},
    create: {
      id: 'patient-1',
      practiceId: practice.id,
      name: 'John Doe',
      dateOfBirth: new Date('1985-05-15'),
      phone: '+1-555-1001',
      email: 'john.doe@example.com',
      address: '456 Main St, City, State 12345',
      preferredContactMethod: 'email',
      notes: 'Regular check-ups, prefers morning appointments',
    },
  })

  // Create tags for patient 1
  await prisma.patientTag.upsert({
    where: {
      patientId_tag: {
        patientId: patient1.id,
        tag: 'vip',
      },
    },
    update: {},
    create: {
      patientId: patient1.id,
      tag: 'vip',
    },
  })
  await prisma.patientTag.upsert({
    where: {
      patientId_tag: {
        patientId: patient1.id,
        tag: 'regular',
      },
    },
    update: {},
    create: {
      patientId: patient1.id,
      tag: 'regular',
    },
  })

  const patient2 = await prisma.patient.upsert({
    where: { id: 'patient-2' },
    update: {},
    create: {
      id: 'patient-2',
      practiceId: practice.id,
      name: 'Jane Smith',
      dateOfBirth: new Date('1990-08-22'),
      phone: '+1-555-1002',
      email: 'jane.smith@example.com',
      preferredContactMethod: 'phone',
    },
  })

  await prisma.patientTag.upsert({
    where: {
      patientId_tag: {
        patientId: patient2.id,
        tag: 'new',
      },
    },
    update: {},
    create: {
      patientId: patient2.id,
      tag: 'new',
    },
  })

  const patient3 = await prisma.patient.upsert({
    where: { id: 'patient-3' },
    update: {},
    create: {
      id: 'patient-3',
      practiceId: practice.id,
      name: 'Robert Johnson',
      dateOfBirth: new Date('1978-12-03'),
      phone: '+1-555-1003',
      preferredContactMethod: 'sms',
      address: '789 Oak Ave, City, State 12345',
    },
  })

  const patients = [patient1, patient2, patient3]

  console.log(`Created ${patients.length} patients`)

  // Create insurance policies
  await prisma.insurancePolicy.createMany({
    data: [
      {
        practiceId: practice.id,
        patientId: patients[0].id,
        providerName: 'Blue Cross Blue Shield',
        planName: 'Gold Plan',
        memberId: 'BC123456789',
        groupId: 'GRP001',
        policyHolderName: 'John Doe',
        policyHolderPhone: '+1-555-1001',
        eligibilityStatus: 'active',
        lastVerifiedAt: new Date(),
      },
      {
        practiceId: practice.id,
        patientId: patients[1].id,
        providerName: 'Aetna',
        planName: 'Silver Plan',
        memberId: 'AE987654321',
        policyHolderName: 'Jane Smith',
        eligibilityStatus: 'active',
        lastVerifiedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  })

  console.log('Created insurance policies')

  // Create sample appointments (for today and tomorrow)
  const today = new Date()
  today.setHours(10, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  await prisma.appointment.createMany({
    data: [
      {
        practiceId: practice.id,
        patientId: patients[0].id,
        status: 'scheduled',
        startTime: today,
        endTime: new Date(today.getTime() + 30 * 60 * 1000),
        timezone: 'America/New_York',
        visitType: 'Consultation',
        reason: 'Annual check-up',
      },
      {
        practiceId: practice.id,
        patientId: patients[1].id,
        status: 'confirmed',
        startTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 45 * 60 * 1000),
        timezone: 'America/New_York',
        visitType: 'Follow-up',
        reason: 'Follow-up on previous visit',
      },
    ],
    skipDuplicates: true,
  })

  console.log('Created sample appointments')

  // Create timeline entries
  await prisma.patientTimelineEntry.createMany({
    data: [
      {
        patientId: patients[0].id,
        type: 'appointment',
        title: 'Appointment scheduled',
        description: 'Consultation scheduled for annual check-up',
        metadata: {},
      },
      {
        patientId: patients[1].id,
        type: 'insurance',
        title: 'Insurance policy added',
        description: 'Aetna Silver Plan added',
        metadata: {},
      },
    ],
    skipDuplicates: true,
  })

  console.log('Created timeline entries')

  console.log('✅ Seeding completed!')
  console.log('\nLogin credentials:')
  console.log('Email: admin@demopractice.com')
  console.log('Password: demo123')
}

main()
  .catch((e) => {
    console.error('Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

