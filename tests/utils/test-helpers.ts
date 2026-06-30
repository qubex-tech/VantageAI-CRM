/**
 * Test Utilities and Helpers
 * 
 * Common utilities for testing across the application
 */

import { vi } from 'vitest'

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<{
  id: string
  email: string
  name: string | null
  practiceId: string | null
  role: string
}> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    practiceId: 'practice-123',
    role: 'regular_user',
    ...overrides,
  }
}

/**
 * Create a mock practice for testing
 */
export function createMockPractice(overrides: Partial<{
  id: string
  name: string
  email: string | null
  phone: string | null
  slug: string | null
}> = {}) {
  return {
    id: 'practice-123',
    name: 'Test Practice',
    email: 'practice@example.com',
    phone: '+15551234567',
    slug: 'test-practice',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a mock patient for testing
 */
export function createMockPatient(overrides: Partial<{
  id: string
  practiceId: string
  name: string
  firstName: string | null
  lastName: string | null
  phone: string
  email: string | null
  dateOfBirth: Date | null
  preferredContactMethod: string
}> = {}) {
  return {
    id: 'patient-123',
    practiceId: 'practice-123',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+15559876543',
    primaryPhone: '+15559876543',
    email: 'patient@example.com',
    dateOfBirth: new Date('1990-01-15'),
    preferredContactMethod: 'phone',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}

/**
 * Create a mock appointment for testing
 */
export function createMockAppointment(overrides: Partial<{
  id: string
  practiceId: string
  patientId: string
  status: string
  startTime: Date
  endTime: Date
  visitType: string
  timezone: string
}> = {}) {
  const startTime = new Date()
  startTime.setHours(startTime.getHours() + 24)
  const endTime = new Date(startTime)
  endTime.setMinutes(endTime.getMinutes() + 30)
  
  return {
    id: 'appointment-123',
    practiceId: 'practice-123',
    patientId: 'patient-123',
    status: 'scheduled',
    startTime,
    endTime,
    timezone: 'America/New_York',
    visitType: 'Consultation',
    reason: null,
    notes: null,
    calEventId: null,
    calBookingId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a mock insurance policy for testing
 */
export function createMockInsurancePolicy(overrides: Partial<{
  id: string
  practiceId: string
  patientId: string
  payerNameRaw: string
  memberId: string
  isPrimary: boolean
}> = {}) {
  return {
    id: 'policy-123',
    practiceId: 'practice-123',
    patientId: 'patient-123',
    payerNameRaw: 'Blue Cross Blue Shield',
    memberId: 'ABC123456',
    groupNumber: 'GRP001',
    planName: 'PPO Gold',
    planType: 'PPO',
    isPrimary: true,
    subscriberIsPatient: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a mock NextRequest for testing API routes
 */
export function createMockNextRequest(
  url: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
) {
  const { method = 'GET', body, headers = {}, searchParams = {} } = options
  
  const urlObj = new URL(url, 'http://localhost:3000')
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value)
  })

  return {
    method,
    url: urlObj.toString(),
    nextUrl: urlObj,
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    cookies: {
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
      delete: vi.fn(),
    },
  }
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate a random UUID-like string for testing
 */
export function generateTestId(): string {
  return 'test-' + Math.random().toString(36).substring(2, 15)
}

/**
 * Create a mock Headers object
 */
export function createMockHeaders(headers: Record<string, string> = {}): Headers {
  return new Headers(headers)
}
