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
  SCHEDULING_SOURCES,
  type ClinicalIntegrationSettings,
  type ClinicalSystemType,
  type SchedulingSettings,
  type SchedulingSource,
  resolveReadSource,
  resolveWriteSource,
} from './types'

function parseSchedulingSource(value: unknown): SchedulingSource | undefined {
  if (typeof value === 'string' && (SCHEDULING_SOURCES as readonly string[]).includes(value)) {
    return value as SchedulingSource
  }
  return undefined
}

function normalizeSchedulingSettings(raw: SchedulingSettings): SchedulingSettings {
  const readSource = resolveReadSource(raw)
  const writeSource = resolveWriteSource(raw)
  const mode: SchedulingSettings['mode'] =
    readSource === writeSource && readSource !== 'none'
      ? (readSource as SchedulingSettings['mode'])
      : raw.mode
  return {
    ...raw,
    readSource,
    writeSource,
    mode,
  }
}

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
  const legacyMode = raw.mode
  const legacyModeValid = legacyMode === 'cal' || legacyMode === 'open_dental' ? legacyMode : undefined
  const readSource = parseSchedulingSource(raw.readSource) ?? legacyModeValid ?? 'cal'
  const writeSource = parseSchedulingSource(raw.writeSource) ?? legacyModeValid ?? 'cal'
  const toPositiveInt = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isInteger(n) && n > 0 ? n : null
  }
  const toPositiveIntArray = (v: unknown): number[] => {
    if (!Array.isArray(v)) return []
    const seen = new Set<number>()
    const out: number[] = []
    for (const item of v) {
      const n = toPositiveInt(item)
      if (n && !seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  }
  return normalizeSchedulingSettings({
    mode: legacyModeValid,
    readSource,
    writeSource,
    defaultReadProvNum: toPositiveInt(raw.defaultReadProvNum),
    defaultReadOperatoryNum: toPositiveInt(raw.defaultReadOperatoryNum),
    defaultReadOperatoryNums: toPositiveIntArray(raw.defaultReadOperatoryNums),
    defaultReadLengthMinutes: toPositiveInt(raw.defaultReadLengthMinutes),
    defaultProvNum: toPositiveInt(raw.defaultProvNum),
    defaultOperatoryNum: toPositiveInt(raw.defaultOperatoryNum),
    defaultOperatoryNums: toPositiveIntArray(raw.defaultOperatoryNums),
    defaultLengthMinutes: toPositiveInt(raw.defaultLengthMinutes),
    defaultReadPractitionerRef:
      typeof raw.defaultReadPractitionerRef === 'string' && raw.defaultReadPractitionerRef.trim()
        ? raw.defaultReadPractitionerRef.trim()
        : null,
    defaultReadPractitionerRefs: Array.isArray(raw.defaultReadPractitionerRefs)
      ? raw.defaultReadPractitionerRefs
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
      : [],
    defaultWritePractitionerRef:
      typeof raw.defaultWritePractitionerRef === 'string' && raw.defaultWritePractitionerRef.trim()
        ? raw.defaultWritePractitionerRef.trim()
        : null,
  })
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
  if (!settings.scheduling) {
    return DEFAULT_SCHEDULING_SETTINGS
  }
  const readSource = resolveReadSource(settings.scheduling)
  const writeSource = resolveWriteSource(settings.scheduling)
  if (
    !(SCHEDULING_SOURCES as readonly string[]).includes(readSource) ||
    !(SCHEDULING_SOURCES as readonly string[]).includes(writeSource)
  ) {
    return DEFAULT_SCHEDULING_SETTINGS
  }
  return normalizeSchedulingSettings(settings.scheduling)
}
