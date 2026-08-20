import { prisma } from '@/lib/db'
import { getOrCreateAvailityIntegration } from '@/lib/availity/config'
import type { PracticeEligibilityConfig } from './types'

export async function getPracticeEligibilitySettings(
  practiceId: string
): Promise<PracticeEligibilityConfig> {
  let settings = await prisma.practiceEligibilitySettings.findUnique({
    where: { practiceId },
  })

  if (!settings) {
    settings = await seedPracticeEligibilitySettings(practiceId)
  }

  return {
    practiceId,
    primaryVendorKey: settings.primaryVendorKey || 'availity',
    apiEnabled: settings.apiEnabled,
    rpaEnabled: settings.rpaEnabled,
    voiceEnabled: settings.voiceEnabled,
    defaultProviderNpi: settings.defaultProviderNpi,
    defaultProviderTaxId: settings.defaultProviderTaxId,
    defaultProviderOrgName: settings.defaultProviderOrgName,
    defaultServiceType: settings.defaultServiceType || '30',
  }
}

async function seedPracticeEligibilitySettings(practiceId: string) {
  const availity = await prisma.availityIntegration.findUnique({
    where: { practiceId },
  })

  return prisma.practiceEligibilitySettings.upsert({
    where: { practiceId },
    create: {
      practiceId,
      primaryVendorKey: 'availity',
      apiEnabled: availity?.eligibilityApiEnabled ?? true,
      rpaEnabled: availity?.portalRpaEnabled ?? false,
      voiceEnabled: availity?.eligibilityVoiceEnabled ?? true,
      defaultProviderNpi: availity?.defaultProviderNpi ?? null,
      defaultProviderTaxId: availity?.defaultProviderTaxId ?? null,
      defaultServiceType: availity?.defaultServiceType || '30',
    },
    update: {},
  })
}

export async function upsertPracticeEligibilitySettings(
  practiceId: string,
  patch: Partial<{
    primaryVendorKey: string
    apiEnabled: boolean
    rpaEnabled: boolean
    voiceEnabled: boolean
    defaultProviderNpi: string | null
    defaultProviderTaxId: string | null
    defaultProviderOrgName: string | null
    defaultServiceType: string
  }>
) {
  await getPracticeEligibilitySettings(practiceId)

  const data: Record<string, unknown> = {}
  if (patch.primaryVendorKey !== undefined) data.primaryVendorKey = patch.primaryVendorKey
  if (patch.apiEnabled !== undefined) data.apiEnabled = patch.apiEnabled
  if (patch.rpaEnabled !== undefined) data.rpaEnabled = patch.rpaEnabled
  if (patch.voiceEnabled !== undefined) data.voiceEnabled = patch.voiceEnabled
  if (patch.defaultProviderNpi !== undefined) {
    data.defaultProviderNpi = patch.defaultProviderNpi
  }
  if (patch.defaultProviderTaxId !== undefined) {
    data.defaultProviderTaxId = patch.defaultProviderTaxId
  }
  if (patch.defaultProviderOrgName !== undefined) {
    data.defaultProviderOrgName = patch.defaultProviderOrgName
  }
  if (patch.defaultServiceType !== undefined) {
    data.defaultServiceType = patch.defaultServiceType || '30'
  }

  const settings = await prisma.practiceEligibilitySettings.update({
    where: { practiceId },
    data,
  })

  // Keep AvailityIntegration method flags in sync so older readers stay consistent
  if (
    patch.apiEnabled !== undefined ||
    patch.rpaEnabled !== undefined ||
    patch.voiceEnabled !== undefined ||
    patch.defaultProviderNpi !== undefined ||
    patch.defaultProviderTaxId !== undefined ||
    patch.defaultServiceType !== undefined
  ) {
    await getOrCreateAvailityIntegration(practiceId)
    await prisma.availityIntegration.update({
      where: { practiceId },
      data: {
        ...(patch.apiEnabled !== undefined
          ? { eligibilityApiEnabled: patch.apiEnabled, isActive: patch.apiEnabled }
          : {}),
        ...(patch.rpaEnabled !== undefined ? { portalRpaEnabled: patch.rpaEnabled } : {}),
        ...(patch.voiceEnabled !== undefined
          ? { eligibilityVoiceEnabled: patch.voiceEnabled }
          : {}),
        ...(patch.defaultProviderNpi !== undefined
          ? { defaultProviderNpi: patch.defaultProviderNpi }
          : {}),
        ...(patch.defaultProviderTaxId !== undefined
          ? { defaultProviderTaxId: patch.defaultProviderTaxId }
          : {}),
        ...(patch.defaultServiceType !== undefined
          ? { defaultServiceType: patch.defaultServiceType || '30' }
          : {}),
      },
    })
  }

  return settings
}
