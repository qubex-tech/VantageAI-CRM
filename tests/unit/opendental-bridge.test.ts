import { describe, it, expect, vi } from 'vitest'
import { buildAuthorizationHeader } from '@vantage/opendental-sdk'

vi.mock('@/lib/db', () => ({
  prisma: {
    openDentalConnection: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    integrationAuditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-supabase', () => ({
  getSupabaseSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', email: 'admin@test.com' } }),
}))

vi.mock('@/lib/sync-supabase-user', () => ({
  syncSupabaseUserToPrisma: vi.fn().mockResolvedValue({
    id: 'user-1',
    email: 'admin@test.com',
    name: 'Admin',
    practiceId: 'practice-1',
    role: 'admin',
  }),
}))

describe('Open Dental bridge', () => {
  it('builds authorization header for SDK', () => {
    const header = buildAuthorizationHeader({
      developerKey: 'dev-key',
      customerKey: 'cust-key',
    })
    expect(header).toBe('ODFHIR dev-key/cust-key')
  })

  it('sanitizes connection response without exposing customer key', async () => {
    const { sanitizeConnectionForResponse } = await import('@/lib/integrations/opendental/factory')
    const sanitized = sanitizeConnectionForResponse({
      id: 'conn-1',
      practiceId: 'practice-1',
      displayName: 'Test Dental',
      apiMode: 'remote',
      baseUrl: 'https://api.opendental.com/api/v1',
      fallbackBaseUrls: [],
      status: 'connected',
      lastHealthCheckAt: null,
      lastSuccessfulSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      odVersion: null,
      enabledPermissions: null,
      capabilityMetadata: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    expect(sanitized).not.toHaveProperty('customerKeyEncrypted')
    expect(sanitized.hasCustomerKey).toBe(true)
  })
})
