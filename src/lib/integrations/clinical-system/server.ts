import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { canConfigureAPIs } from '@/lib/permissions'
import { getEhrSettings } from '@/lib/integrations/ehr/server'
import { getOpenDentalConnection } from '@/lib/integrations/opendental/factory'
import {
  CLINICAL_SYSTEM_TYPES,
  DEFAULT_SCHEDULING_SETTINGS,
  SCHEDULING_MODES,
  type ClinicalIntegrationSettings,
  type ClinicalSystemType,
  type SchedulingSettings,
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

function parseScheduling(value: unknown): SchedulingSettings | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const mode = raw.mode
  if (mode !== 'cal' && mode !== 'open_dental') return undefined
  const toPositiveInt = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isInteger(n) && n > 0 ? n : null
  }
  return {
    mode,
    defaultReadProvNum: toPositiveInt(raw.defaultReadProvNum),
    defaultReadOperatoryNum: toPositiveInt(raw.defaultReadOperatoryNum),
    defaultReadLengthMinutes: toPositiveInt(raw.defaultReadLengthMinutes),
    defaultProvNum: toPositiveInt(raw.defaultProvNum),
    defaultOperatoryNum: toPositiveInt(raw.defaultOperatoryNum),
    defaultLengthMinutes: toPositiveInt(raw.defaultLengthMinutes),
  }
}

function parseStoredClinicalSettings(value: unknown): ClinicalIntegrationSettings | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const system = (value as ClinicalIntegrationSettings).system
  if (!CLINICAL_SYSTEM_TYPES.includes(system)) {
    return null
  }
  return { system, scheduling: parseScheduling((value as Record<string, unknown>).scheduling) }
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

/**
 * Merge-aware update so saving `system` does not wipe `scheduling` (and vice versa).
 */
export async function upsertClinicalIntegrationSettings(
  practiceId: string,
  patch: Partial<ClinicalIntegrationSettings>
) {
  const { settings: existing } = await getClinicalIntegrationSettings(practiceId)
  const merged: ClinicalIntegrationSettings = {
    system: patch.system ?? existing.system,
    scheduling: patch.scheduling ?? existing.scheduling,
  }
  const settingsJson = merged as unknown as Prisma.InputJsonValue
  return prisma.practiceSettings.upsert({
    where: { practiceId },
    update: { clinicalIntegrations: settingsJson },
    create: {
      practiceId,
      clinicalIntegrations: settingsJson,
    },
  })
}

/** Resolve the effective scheduling settings for a practice (defaults to Cal.com). */
export async function getSchedulingSettings(practiceId: string): Promise<SchedulingSettings> {
  const { settings } = await getClinicalIntegrationSettings(practiceId)
  if (!settings.scheduling || !SCHEDULING_MODES.includes(settings.scheduling.mode)) {
    return DEFAULT_SCHEDULING_SETTINGS
  }
  return settings.scheduling
}
