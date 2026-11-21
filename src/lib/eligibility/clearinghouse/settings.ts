import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getOrCreateAvailityIntegration } from '@/lib/availity/config'
import {
  isLonestarPracticeName,
  LONESTAR_DEFAULT_DISPLAY_FIELDS,
  parseDisplayFieldsConfig,
  type EligibilityDisplayFieldsConfig,
} from '@/lib/eligibility/display-fields'
import {
  normalizeServiceTypeCodes,
  primaryServiceTypeCode,
} from '@/lib/eligibility/service-types'
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

  if (settings.displayFields == null) {
    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
      select: { name: true },
    })
    if (isLonestarPracticeName(practice?.name)) {
      settings = await prisma.practiceEligibilitySettings.update({
        where: { practiceId },
        data: {
          displayFields: LONESTAR_DEFAULT_DISPLAY_FIELDS as unknown as Prisma.InputJsonValue,
        },
      })
    }
  }

  const codes = codesFromSettings(settings)
  return {
    practiceId,
    primaryVendorKey: settings.primaryVendorKey || 'availity',
    apiEnabled: settings.apiEnabled,
    rpaEnabled: settings.rpaEnabled,
    voiceEnabled: settings.voiceEnabled,
    defaultProviderNpi: settings.defaultProviderNpi,
    defaultProviderTaxId: settings.defaultProviderTaxId,
    defaultProviderOrgName: settings.defaultProviderOrgName,
    defaultServiceType: primaryServiceTypeCode(codes),
    defaultServiceTypeCodes: codes,
    displayFields: parseDisplayFieldsConfig(settings.displayFields),
  }
}

function codesFromSettings(settings: {
  defaultServiceType?: string | null
  defaultServiceTypeCodes?: string[] | null
}): string[] {
  return normalizeServiceTypeCodes(
    settings.defaultServiceTypeCodes?.length
      ? settings.defaultServiceTypeCodes
      : settings.defaultServiceType
  )
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
      defaultServiceTypeCodes: normalizeServiceTypeCodes(availity?.defaultServiceType),
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
    defaultServiceTypeCodes: string[]
    displayFields: EligibilityDisplayFieldsConfig | null
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
  if (
    patch.defaultServiceTypeCodes !== undefined ||
    patch.defaultServiceType !== undefined
  ) {
    const codes = normalizeServiceTypeCodes(
      patch.defaultServiceTypeCodes ?? patch.defaultServiceType
    )
    data.defaultServiceTypeCodes = codes
    data.defaultServiceType = primaryServiceTypeCode(codes)
  }
  if (patch.displayFields !== undefined) {
    data.displayFields =
      patch.displayFields == null
        ? null
        : (parseDisplayFieldsConfig(patch.displayFields) as unknown as Prisma.InputJsonValue)
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
    patch.defaultServiceType !== undefined ||
    patch.defaultServiceTypeCodes !== undefined
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
        ...(patch.defaultServiceType !== undefined ||
        patch.defaultServiceTypeCodes !== undefined
          ? {
              defaultServiceType: primaryServiceTypeCode(
                normalizeServiceTypeCodes(
                  patch.defaultServiceTypeCodes ?? patch.defaultServiceType
                )
              ),
            }
          : {}),
      },
    })
  }

  return settings
}
