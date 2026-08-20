import { getPracticeEligibilitySettings } from './clearinghouse/settings'

export interface EligibilityPathFlags {
  apiEnabled: boolean
  rpaEnabled: boolean
  voiceEnabled: boolean
  primaryVendorKey: string
}

/**
 * Practice-level verification methods for insurance eligibility cascade.
 * Defaults match historical behavior when the settings row is missing.
 */
export async function getEligibilityPathFlags(
  practiceId: string
): Promise<EligibilityPathFlags> {
  const settings = await getPracticeEligibilitySettings(practiceId)
  return {
    apiEnabled: settings.apiEnabled,
    rpaEnabled: settings.rpaEnabled,
    voiceEnabled: settings.voiceEnabled,
    primaryVendorKey: settings.primaryVendorKey,
  }
}
