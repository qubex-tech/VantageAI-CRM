import { describe, it, expect } from 'vitest'
import {
  formatEhrSyncStatusLine,
  getActiveEhrSyncError,
} from '@/lib/integrations/ehr/syncStatusDisplay'

describe('EHR sync status display', () => {
  it('hides errors that occurred before the last successful sync', () => {
    const status = {
      lastCompleteAt: '2026-07-03T06:00:54.000Z',
      lastCompleteMetadata: { synced: 219 },
      lastErrorAt: '2026-07-03T05:30:00.000Z',
      lastErrorMessage: 'This operation was aborted',
    }
    expect(getActiveEhrSyncError(status)).toBeNull()
    expect(formatEhrSyncStatusLine(status)).not.toContain('Latest error')
  })

  it('shows errors that occurred after the last successful sync', () => {
    const status = {
      lastCompleteAt: '2026-07-03T06:00:54.000Z',
      lastCompleteMetadata: { synced: 219, dayErrors: 2 },
      lastErrorAt: '2026-07-03T07:00:00.000Z',
      lastErrorMessage: 'FHIR request failed: 400',
    }
    expect(getActiveEhrSyncError(status)?.message).toContain('400')
    expect(formatEhrSyncStatusLine(status)).toContain('Latest error')
    expect(formatEhrSyncStatusLine(status)).toContain('2 day(s) had partial errors')
  })
})
