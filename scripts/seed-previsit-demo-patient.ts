/**
 * Seed a single patient with rich clinical/operational context for Pre-Visit Chart testing.
 *
 * Usage:
 *   tsx scripts/seed-previsit-demo-patient.ts --practiceId=<practice-id>
 *
 * Optional:
 *   --userId=<user-id>  (author for notes/forms; otherwise first user in practice)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : undefined
}

async function main() {
  const practiceId = getArg('practiceId')
  const providedUserId = getArg('userId')

  if (!practiceId) {
    throw new Error('Missing required --practiceId argument')
  }

  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: { id: true, name: true },
  })
  if (!practice) {
    throw new Error(`Practice not found: ${practiceId}`)
  }

  let actorUserId = providedUserId
  if (!actorUserId) {
    const fallbackUser = await prisma.user.findFirst({
      where: { practiceId },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!fallbackUser) {
      throw new Error('No user found in this practice; pass --userId explicitly')
    }
    actorUserId = fallbackUser.id
  }

  const existing = await prisma.patient.findFirst({
    where: {
      practiceId,
      externalEhrId: 'previsit-demo-001',
      deletedAt: null,
    },
    select: { id: true },
  })

  const patient = existing
    ? await prisma.patient.update({
        where: { id: existing.id },
        data: {
          firstName: 'Amina',
          lastName: 'Rahman',
          name: 'Amina Rahman',
          preferredName: 'Amina',
          dateOfBirth: new Date('1987-02-14'),
          gender: 'female',
          pronouns: 'she/her',
          primaryLanguage: 'English',
          phone: '+1-555-331-9001',
          primaryPhone: '+1-555-331-9001',
          secondaryPhone: '+1-555-331-9002',
          email: 'amina.rahman+previsit@example.com',
          addressLine1: '1287 Maple Grove Ave',
          city: 'Austin',
          state: 'TX',
          postalCode: '78758',
          preferredContactMethod: 'sms',
          preferredChannel: 'sms',
          smsOptIn: true,
          smsOptInAt: new Date('2025-10-01T09:00:00.000Z'),
          emailOptIn: true,
          voiceOptIn: false,
          doNotContact: false,
          consentSource: 'staff',
          insuranceStatus: 'verified',
          lastInsuranceVerifiedAt: new Date(),
          notes:
            'Pre-visit charting demo patient with multi-source history, medication updates, and care coordination notes.',
        },
      })
    : await prisma.patient.create({
        data: {
          practiceId,
          externalEhrId: 'previsit-demo-001',
          firstName: 'Amina',
          lastName: 'Rahman',
          name: 'Amina Rahman',
          preferredName: 'Amina',
          dateOfBirth: new Date('1987-02-14'),
          gender: 'female',
          pronouns: 'she/her',
          primaryLanguage: 'English',
          phone: '+1-555-331-9001',
          primaryPhone: '+1-555-331-9001',
          secondaryPhone: '+1-555-331-9002',
          email: 'amina.rahman+previsit@example.com',
          addressLine1: '1287 Maple Grove Ave',
          city: 'Austin',
          state: 'TX',
          postalCode: '78758',
          preferredContactMethod: 'sms',
          preferredChannel: 'sms',
          smsOptIn: true,
          smsOptInAt: new Date('2025-10-01T09:00:00.000Z'),
          emailOptIn: true,
          voiceOptIn: false,
          doNotContact: false,
          consentSource: 'staff',
          insuranceStatus: 'verified',
          lastInsuranceVerifiedAt: new Date(),
          notes:
            'Pre-visit charting demo patient with multi-source history, medication updates, and care coordination notes.',
        },
      })

  const primaryPolicy = await prisma.insurancePolicy.findFirst({
    where: { practiceId, patientId: patient.id, isPrimary: true },
    select: { id: true },
  })

  if (!primaryPolicy) {
    await prisma.insurancePolicy.create({
      data: {
        practiceId,
        patientId: patient.id,
        payerNameRaw: 'Blue Cross Blue Shield of Texas',
        insurerPhoneRaw: '+1-800-555-2048',
        insurerPhoneNormalized: '+18005552048',
        memberId: 'BCBSTX-44589021',
        groupNumber: 'G-RTM-1204',
        planName: 'BCBS PPO Gold',
        planType: 'PPO',
        isPrimary: true,
        subscriberIsPatient: true,
      },
    })
  }

  const now = new Date()
  const past1 = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000)
  const past2 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
  const upcoming1 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)

  const appointmentSeeds = [
    {
      id: `previsit-apt-${patient.id}-1`,
      status: 'completed',
      startTime: past1,
      endTime: new Date(past1.getTime() + 30 * 60 * 1000),
      visitType: 'Rheumatology Follow-up',
      reason: 'Persistent morning stiffness and medication review',
      notes: 'Reported partial response to methotrexate, fatigue persists.',
    },
    {
      id: `previsit-apt-${patient.id}-2`,
      status: 'completed',
      startTime: past2,
      endTime: new Date(past2.getTime() + 30 * 60 * 1000),
      visitType: 'Lab Review',
      reason: 'Review elevated inflammatory markers',
      notes: 'CRP and ESR reviewed; plan to adjust therapy if still elevated.',
    },
    {
      id: `previsit-apt-${patient.id}-3`,
      status: 'scheduled',
      startTime: upcoming1,
      endTime: new Date(upcoming1.getTime() + 30 * 60 * 1000),
      visitType: 'Pre-Visit Follow-up',
      reason: 'Assess symptom progression and treatment tolerance',
      notes: 'Bring recent outside MRI report and updated medication list.',
    },
  ] as const

  for (const seed of appointmentSeeds) {
    await prisma.appointment.upsert({
      where: { id: seed.id },
      update: seed,
      create: {
        ...seed,
        practiceId,
        patientId: patient.id,
        timezone: 'America/Chicago',
      },
    })
  }

  const noteSeeds = [
    {
      type: 'medical',
      content:
        'Patient reports worsening morning stiffness (>90 minutes) over last 4 weeks, especially hands and wrists. Denies fever or new rash.',
    },
    {
      type: 'medication',
      content:
        'Methotrexate reduced from 20mg weekly to 15mg weekly two weeks ago due to nausea and fatigue. Folic acid continued daily.',
    },
    {
      type: 'medical',
      content:
        'Outside MRI (uploaded) notes mild synovitis in bilateral wrists; no erosive progression compared to prior study.',
    },
  ] as const

  for (const note of noteSeeds) {
    const existingNote = await prisma.patientNote.findFirst({
      where: {
        patientId: patient.id,
        type: note.type,
        content: note.content,
      },
      select: { id: true },
    })
    if (!existingNote) {
      await prisma.patientNote.create({
        data: {
          patientId: patient.id,
          practiceId,
          userId: actorUserId!,
          type: note.type,
          content: note.content,
        },
      })
    }
  }

  const timelineSeeds = [
    {
      type: 'document',
      title: 'Outside MRI report received',
      description: 'Imaging report imported from Austin Imaging Center (MRI wrists, Jan 2026).',
    },
    {
      type: 'note',
      title: 'Medication intolerance documented',
      description: 'Nausea/fatigue after methotrexate dose increase; dose reduced.',
    },
    {
      type: 'appointment',
      title: 'Upcoming follow-up scheduled',
      description: 'Follow-up visit scheduled for symptom reassessment in 5 days.',
    },
    {
      type: 'other',
      title: 'Care coordination update',
      description: 'Cardiology referral note reviewed; no contraindication to current DMARD plan.',
    },
  ] as const

  for (const entry of timelineSeeds) {
    const existingEntry = await prisma.patientTimelineEntry.findFirst({
      where: {
        patientId: patient.id,
        type: entry.type,
        title: entry.title,
      },
      select: { id: true },
    })
    if (!existingEntry) {
      await prisma.patientTimelineEntry.create({
        data: {
          patientId: patient.id,
          type: entry.type,
          title: entry.title,
          description: entry.description,
          metadata: { seed: 'previsit-demo' },
        },
      })
    }
  }

  const formTemplate = await prisma.formTemplate.upsert({
    where: {
      id: `previsit-template-${practiceId}`,
    },
    update: {
      name: 'Pre-Visit Symptom Intake',
      description: 'Captures symptom changes, medication tolerance, and recent events.',
      status: 'published',
      schema: {
        fields: [
          { id: 'pain_score', type: 'number', label: 'Pain score (0-10)' },
          { id: 'morning_stiffness_minutes', type: 'number', label: 'Morning stiffness minutes' },
          { id: 'new_symptoms', type: 'textarea', label: 'New or worsening symptoms' },
          { id: 'med_changes', type: 'textarea', label: 'Medication changes since last visit' },
        ],
      },
    },
    create: {
      id: `previsit-template-${practiceId}`,
      practiceId,
      name: 'Pre-Visit Symptom Intake',
      description: 'Captures symptom changes, medication tolerance, and recent events.',
      category: 'medical_history',
      status: 'published',
      schema: {
        fields: [
          { id: 'pain_score', type: 'number', label: 'Pain score (0-10)' },
          { id: 'morning_stiffness_minutes', type: 'number', label: 'Morning stiffness minutes' },
          { id: 'new_symptoms', type: 'textarea', label: 'New or worsening symptoms' },
          { id: 'med_changes', type: 'textarea', label: 'Medication changes since last visit' },
        ],
      },
      isSystem: false,
      createdByUserId: actorUserId!,
    },
  })

  const existingSubmission = await prisma.formSubmission.findFirst({
    where: {
      practiceId,
      patientId: patient.id,
      formTemplateId: formTemplate.id,
    },
    select: { id: true },
  })
  if (!existingSubmission) {
    const formRequest = await prisma.formRequest.create({
      data: {
        practiceId,
        patientId: patient.id,
        formTemplateId: formTemplate.id,
        status: 'submitted',
        sentAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        completedAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
        createdByUserId: actorUserId!,
        metadata: { seed: 'previsit-demo' },
      },
    })

    await prisma.formSubmission.create({
      data: {
        practiceId,
        patientId: patient.id,
        formTemplateId: formTemplate.id,
        formRequestId: formRequest.id,
        formType: 'medical_history',
        status: 'submitted',
        submittedAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
        formData: {
          pain_score: 7,
          morning_stiffness_minutes: 95,
          new_symptoms: 'Worse hand swelling in morning; fatigue by afternoon.',
          med_changes: 'Reduced methotrexate to 15mg weekly due to nausea.',
        },
      },
    })
  }

  const uploads = [
    {
      fileName: 'MRI_Wrists_Jan2026.pdf',
      fileUrl: 'https://example.com/previsit-demo/mri-wrists-jan2026.pdf',
      fileType: 'application/pdf',
      category: 'medical_record',
    },
    {
      fileName: 'Cardiology_Consult_Dec2025.pdf',
      fileUrl: 'https://example.com/previsit-demo/cardiology-consult-dec2025.pdf',
      fileType: 'application/pdf',
      category: 'medical_record',
    },
    {
      fileName: 'Recent_Lab_Trends_Feb2026.pdf',
      fileUrl: 'https://example.com/previsit-demo/lab-trends-feb2026.pdf',
      fileType: 'application/pdf',
      category: 'medical_record',
    },
  ] as const

  for (const upload of uploads) {
    const existingUpload = await prisma.documentUpload.findFirst({
      where: {
        practiceId,
        patientId: patient.id,
        fileName: upload.fileName,
      },
      select: { id: true },
    })
    if (!existingUpload) {
      await prisma.documentUpload.create({
        data: {
          practiceId,
          patientId: patient.id,
          fileName: upload.fileName,
          fileUrl: upload.fileUrl,
          fileType: upload.fileType,
          category: upload.category,
          status: 'reviewed',
        },
      })
    }
  }

  console.log('✅ Pre-visit demo patient ready')
  console.log(`Practice: ${practice.name} (${practice.id})`)
  console.log(`Patient ID: ${patient.id}`)
  console.log(`Patient Name: ${patient.name}`)
  console.log(`Actor User ID: ${actorUserId}`)
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed pre-visit demo patient:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
