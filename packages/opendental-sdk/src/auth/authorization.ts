import type { OpenDentalCredentials } from '../models/common'

export function buildAuthorizationHeader(credentials: OpenDentalCredentials): string {
  const { developerKey, customerKey } = credentials
  if (!developerKey?.trim() || !customerKey?.trim()) {
    throw new Error('Developer key and customer key are required')
  }
  return `ODFHIR ${developerKey.trim()}/${customerKey.trim()}`
}

export function validateCredentials(credentials: OpenDentalCredentials): void {
  if (!credentials.developerKey?.trim()) {
    throw new Error('Developer key is required')
  }
  if (!credentials.customerKey?.trim()) {
    throw new Error('Customer key is required')
  }
}
