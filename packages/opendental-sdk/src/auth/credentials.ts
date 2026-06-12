import type { OpenDentalCredentials } from '../models/common'

export type { OpenDentalCredentials }

export function createCredentials(developerKey: string, customerKey: string): OpenDentalCredentials {
  return { developerKey, customerKey }
}

export const TEST_CREDENTIALS: OpenDentalCredentials = {
  developerKey: 'NFF6i0KrXrxDkZHt',
  customerKey: 'VzkmZEaUWOjnQX2z',
}
