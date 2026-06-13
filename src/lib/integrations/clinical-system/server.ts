import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { canConfigureAPIs } from '@/lib/permissions'
import { getEhrSettings } from '@/lib/integrations/ehr/server'
import { getOpenDentalConnection } from '@/lib/integrations/opendental/factory'
import {
  CLINICAL_SYSTEM_TYPES,
  type ClinicalIntegrationSettings,
  type ClinicalSystemType,
} from './types'

export async function resolveClinicalSystemPractice(practiceIdOverride?: string) {
  const session = await getSupabaseSession()
  if (!session?.user) {
    throw new Error('Not authenticated')
  }
  const user = await syncSupabaseUserToPrisma(session.user)
  if (!user) {
    throw new Error('User not found')
  }

  if (practiceIdOverride) {
    if (
      !canConfigureAPIs({
        id: user.id,
        email: user.email,
        name: user.name,
        practiceId: user.practiceId,
        role: user.role,
      })
    ) {
      throw new Error('Permission denied')
    }
    return { user, practiceId: practiceIdOverride }
  }

  if (!user.practiceId) {
    throw new Error('User is missing practice context')
  }
  return { user, practiceId: user.practiceId }
}

function parseStoredClinicalSettings(value: unknown): ClinicalIntegrationSettings | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const system = (value as ClinicalIntegrationSettings).system
  if (!CLINICAL_SYSTEM_TYPES.includes(system)) {
    return null
  }
  return { system }
}

export async function inferClinicalSystem(practiceId: string): Promise<ClinicalSystemType> {
  const [openDental, ehrSettings] = await Promise.all([
    getOpenDentalConnection(practiceId),
    getEhrSettings(practiceId),
  ])

  if (openDental?.isActive) {
    return 'open_dental'
  }
  if (ehrSettings?.enabledProviders?.length) {
    return 'fhir'
  }
  return 'none'
}

export async function getClinicalIntegrationSettings(
  practiceId: string
): Promise<{ settings: ClinicalIntegrationSettings; inferred: boolean }> {
  const row = await prisma.practiceSettings.findUnique({
    where: { practiceId },
    select: { clinicalIntegrations: true },
  })

  const stored = parseStoredClinicalSettings(row?.clinicalIntegrations)
  if (stored) {
    return { settings: stored, inferred: false }
  }

  const system = await inferClinicalSystem(practiceId)
  return { settings: { system }, inferred: true }
}

export async function upsertClinicalIntegrationSettings(
  practiceId: string,
  settings: ClinicalIntegrationSettings
) {
  const settingsJson = settings as Prisma.InputJsonValue
  return prisma.practiceSettings.upsert({
    where: { practiceId },
    update: { clinicalIntegrations: settingsJson },
    create: {
      practiceId,
      clinicalIntegrations: settingsJson,
    },
  })
}
