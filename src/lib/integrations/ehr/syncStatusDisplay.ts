export type EhrSyncStatusDisplayInput = {
  lastCompleteAt: string | null
  lastCompleteMetadata?: Record<string, unknown> | null
  lastErrorAt?: string | null
  lastErrorMessage?: string | null
}

/** Only surface errors that occurred after the last successful sync. */
export function getActiveEhrSyncError(status: EhrSyncStatusDisplayInput) {
  if (!status.lastErrorAt || !status.lastErrorMessage) {
    return null
  }
  if (!status.lastCompleteAt) {
    return {
      at: status.lastErrorAt,
      message: status.lastErrorMessage,
    }
  }
  const errorTime = new Date(status.lastErrorAt).getTime()
  const completeTime = new Date(status.lastCompleteAt).getTime()
  if (!Number.isFinite(errorTime) || !Number.isFinite(completeTime) || errorTime <= completeTime) {
    return null
  }
  return {
    at: status.lastErrorAt,
    message: status.lastErrorMessage,
  }
}

export function formatEhrSyncStatusLine(status: EhrSyncStatusDisplayInput): string | null {
  if (!status.lastCompleteAt) {
    const activeError = getActiveEhrSyncError(status)
    if (activeError) {
      return `EHR sync has not completed successfully. Latest error: ${activeError.message.slice(0, 160)}`
    }
    return 'EHR sync has not completed successfully yet.'
  }

  const last = new Date(status.lastCompleteAt).toLocaleString()
  const synced = status.lastCompleteMetadata?.synced
  const dayErrors = status.lastCompleteMetadata?.dayErrors
  let line =
    typeof synced === 'number'
      ? `Last EHR sync: ${last} (${synced} appointment(s))`
      : `Last EHR sync: ${last}`

  if (typeof dayErrors === 'number' && dayErrors > 0) {
    line += `. ${dayErrors} day(s) had partial errors.`
  }

  const activeError = getActiveEhrSyncError(status)
  if (activeError) {
    line += `. Latest error: ${activeError.message.slice(0, 160)}`
  }

  return line
}
