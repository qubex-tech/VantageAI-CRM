import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { findOrCreatePatientByPhone, bookAppointment } from '@/lib/agentActions'

const prisma = new PrismaClient()

describe('Agent Actions', () => {
  let practiceId: string
  let patientId: string

  beforeAll(async () => {
    const practice = await prisma.practice.create({
      data: {
        name: 'Test Practice',
        email: 'test@example.com',
      },
    })
    practiceId = practice.id
  })

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { practiceId } })
    await prisma.patient.deleteMany({ where: { practiceId } })
    await prisma.practice.delete({ where: { id: practiceId } })
    await prisma.$disconnect()
  })

  it('should find or create patient by phone', async () => {
    const result = await findOrCreatePatientByPhone(
      practiceId,
      '+1555999999',
      {
        name: 'Test Patient',
        email: 'test@example.com',
      }
    )

    expect(result).toHaveProperty('patientId')
    expect(result).toHaveProperty('isNew')
    expect(result.patient).toHaveProperty('name', 'Test Patient')
    expect(result.patient).toHaveProperty('phone')
    
    patientId = result.patientId

    // Try to find the same patient again
    const result2 = await findOrCreatePatientByPhone(practiceId, '+1555999999')
    expect(result2.patientId).toBe(patientId)
    expect(result2.isNew).toBe(false)
  })

  it('should require name for new patients', async () => {
    await expect(
      findOrCreatePatientByPhone(practiceId, '+1555888888')
    ).rejects.toThrow('Patient name is required')
  })

  // Note: bookAppointment test would require Cal.com integration setup
  // This is a placeholder showing the structure
  it.skip('should book appointment via Cal.com', async () => {
    // This test would require:
    // 1. Cal.com integration configured
    // 2. Event type mapping
    // 3. Mock or real Cal.com API
  })
})

