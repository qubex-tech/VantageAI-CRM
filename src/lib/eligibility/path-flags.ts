import { prisma } from '@/lib/db'

export interface EligibilityPathFlags {
  apiEnabled: boolean
  rpaEnabled: boolean
  voiceEnabled: boolean
}

/**
 * Practice-level verification methods for insurance eligibility cascade.
 * Defaults match historical behavior when the integration row is missing.
 */
export async function getEligibilityPathFlags(
  practiceId: string
): Promise<EligibilityPathFlags> {
  const integration = await prisma.availityIntegration.findUnique({
    where: { practiceId },
    select: {
      eligibilityApiEnabled: true,
      portalRpaEnabled: true,
      eligibilityVoiceEnabled: true,
    },
  })

  return {
    apiEnabled: integration?.eligibilityApiEnabled ?? true,
    rpaEnabled: integration?.portalRpaEnabled ?? false,
    voiceEnabled: integration?.eligibilityVoiceEnabled ?? true,
  }
}
