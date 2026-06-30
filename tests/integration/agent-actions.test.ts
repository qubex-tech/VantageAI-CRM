import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Skip database tests if no DATABASE_URL
const shouldSkip = !process.env.DATABASE_URL

const prisma = shouldSkip ? null : new PrismaClient()

describe.skipIf(shouldSkip)('Agent Actions', () => {
  let practiceId: string
  let patientId: string

  beforeAll(async () => {
    if (!prisma) return
    // Dynamically import to avoid module load errors when DATABASE_URL is missing
    const { findOrCreatePatientByPhone } = await import('@/lib/agentActions')
    const practice = await prisma.practice.create({
      data: {
        name: 'Test Practice',
        email: 'test@example.com',
      },
    })
    practiceId = practice.id
  })

  afterAll(async () => {
    if (!prisma || !practiceId) return
    await prisma.appointment.deleteMany({ where: { practiceId } })
    await prisma.patient.deleteMany({ where: { practiceId } })
    await prisma.practice.delete({ where: { id: practiceId } })
    await prisma.$disconnect()
  })

  it('should find or create patient by phone', async () => {
    if (!prisma) return
    const { findOrCreatePatientByPhone } = await import('@/lib/agentActions')
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
    if (!prisma) return
    const { findOrCreatePatientByPhone } = await import('@/lib/agentActions')
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

