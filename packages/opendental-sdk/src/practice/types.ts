import type { ApiMode, OpenDentalCredentials } from '../models/common'

export type PracticeContext = {
  practiceId: string
  connectionId: string
  credentials: OpenDentalCredentials
  baseUrl: string
  fallbackBaseUrls?: string[]
  apiMode: ApiMode
  enabledPermissions?: string[]
  displayName?: string
}

export type OpenDentalPracticeConfig = {
  practiceId: string
  connectionId: string
  displayName: string
  customerKey: string
  developerKey: string
  apiMode?: ApiMode
  baseUrl?: string
  fallbackBaseUrls?: string[]
  enabledPermissions?: string[]
}

export function toPracticeContext(config: OpenDentalPracticeConfig): PracticeContext {
  return {
    practiceId: config.practiceId,
    connectionId: config.connectionId,
    displayName: config.displayName,
    credentials: {
      developerKey: config.developerKey,
      customerKey: config.customerKey,
    },
    baseUrl: config.baseUrl ?? 'https://api.opendental.com/api/v1',
    fallbackBaseUrls: config.fallbackBaseUrls,
    apiMode: config.apiMode ?? 'remote',
    enabledPermissions: config.enabledPermissions,
  }
}
