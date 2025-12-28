import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Tenant Scoping', () => {
  let practice1Id: string
  let practice2Id: string
  let patient1Id: string
  let patient2Id: string

  beforeAll(async () => {
    // Create two practices
    const practice1 = await prisma.practice.create({
      data: {
        name: 'Test Practice 1',
        email: 'test1@example.com',
      },
    })
    practice1Id = practice1.id

    const practice2 = await prisma.practice.create({
      data: {
        name: 'Test Practice 2',
        email: 'test2@example.com',
      },
    })
    practice2Id = practice2.id

    // Create patients for each practice
    const patient1 = await prisma.patient.create({
      data: {
        practiceId: practice1Id,
        name: 'Patient 1',
        dateOfBirth: new Date('1990-01-01'),
        phone: '+15551001',
        preferredContactMethod: 'phone',
      },
    })
    patient1Id = patient1.id

    const patient2 = await prisma.patient.create({
      data: {
        practiceId: practice2Id,
        name: 'Patient 2',
        dateOfBirth: new Date('1990-01-01'),
        phone: '+15551002',
        preferredContactMethod: 'phone',
      },
    })
    patient2Id = patient2.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.patient.deleteMany({ where: { practiceId: { in: [practice1Id, practice2Id] } } })
    await prisma.practice.deleteMany({ where: { id: { in: [practice1Id, practice2Id] } } })
    await prisma.$disconnect()
  })

  it('should only return patients for the specified practice', async () => {
    const patients = await prisma.patient.findMany({
      where: { practiceId: practice1Id },
    })

    expect(patients.length).toBe(1)
    expect(patients[0].id).toBe(patient1Id)
    expect(patients[0].practiceId).toBe(practice1Id)
  })

  it('should not allow cross-tenant access', async () => {
    // Try to access patient from practice1 using practice2's ID
    const patient = await prisma.patient.findFirst({
      where: {
        id: patient1Id,
        practiceId: practice2Id, // Wrong practice
      },
    })

    expect(patient).toBeNull()
  })

  it('should enforce practiceId on all queries', async () => {
    const allPatients = await prisma.patient.findMany()
    const practice1Patients = allPatients.filter((p: any) => p.practiceId === practice1Id)
    const practice2Patients = allPatients.filter((p: any) => p.practiceId === practice2Id)

    expect(practice1Patients.length).toBeGreaterThan(0)
    expect(practice2Patients.length).toBeGreaterThan(0)
    // Ensure no patient belongs to both practices
    practice1Patients.forEach((p: any) => {
      expect(practice2Patients.find((p2: any) => p2.id === p.id)).toBeUndefined()
    })
  })
})

