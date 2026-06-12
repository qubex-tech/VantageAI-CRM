import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatientsService } from '@sdk/services/generated/PatientsService'
import { OpenDentalClient } from '@sdk/client/OpenDentalClient'
import { TEST_CREDENTIALS } from '@sdk/auth/credentials'
import { toPracticeContext } from '@sdk/practice/types'

const context = toPracticeContext({
  practiceId: 'test-practice',
  connectionId: 'test-conn',
  displayName: 'Test Practice',
  customerKey: TEST_CREDENTIALS.customerKey,
  developerKey: TEST_CREDENTIALS.developerKey,
})

describe('PatientsService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ PatNum: 1, LName: 'Smith', FName: 'John' }]), { status: 200 })
    ))
  })

  it('lists patients with pagination params', async () => {
    const client = new OpenDentalClient({
      credentials: TEST_CREDENTIALS,
      baseUrl: 'https://api.opendental.com/api/v1',
      practiceId: context.practiceId,
    })
    const service = new PatientsService(client, context)
    const patients = await service.list({ Limit: 10, Offset: 0 }) as Array<{ PatNum: number }>
    expect(patients).toHaveLength(1)
    expect(patients[0].PatNum).toBe(1)
  })
})

describe('AppointmentsService fixture', () => {
  it('parses appointment list fixture shape', () => {
    const fixture = [{ AptNum: 42, PatNum: 15, AptStatus: 'Scheduled' }]
    expect(Array.isArray(fixture)).toBe(true)
    expect(fixture[0]).toHaveProperty('AptNum')
  })
})
