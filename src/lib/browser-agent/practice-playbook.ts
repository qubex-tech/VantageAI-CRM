import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const AVAILITY_ELIGIBILITY_PLAYBOOK_KEY = 'availity.eligibility'

export type AvailityNetworkFilter = 'In Network' | 'Out of Network' | 'All Networks'

export type AvailityEligibilityPlaybookConfig = {
  version: 1
  resultCapture: {
    networkFilter: AvailityNetworkFilter
    scrollPasses: number
    /** Benefit Information tabs/rows to open while scraping results */
    expandLabels: string[]
  }
  payerSelection: {
    preferShortBrandFirst: boolean
    rejectMedicareUnlessCrmSaysSo: boolean
  }
  interpretation: {
    requireMemberScopedActiveCoverage: boolean
  }
}

export type PracticePlaybookRecord = {
  id: string
  practiceId: string
  playbookKey: string
  name: string
  site: string
  isActive: boolean
  config: AvailityEligibilityPlaybookConfig
  sourceVideoUrl: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export function getDefaultAvailityEligibilityConfig(): AvailityEligibilityPlaybookConfig {
  return {
    version: 1,
    resultCapture: {
      networkFilter: 'In Network',
      scrollPasses: 6,
      expandLabels: [
        'Benefit Information',
        'Expand',
        'Professional (Physician) Visit - Office',
        'Professional (Physician) Visit - Office - 98',
        'Professional (Physician) - 96',
        'Specialist',
        'Office Visit',
        'Medical Care - 1',
      ],
    },
    payerSelection: {
      preferShortBrandFirst: true,
      rejectMedicareUnlessCrmSaysSo: true,
    },
    interpretation: {
      requireMemberScopedActiveCoverage: true,
    },
  }
}

export function normalizeAvailityEligibilityConfig(
  raw: unknown
): AvailityEligibilityPlaybookConfig {
  const defaults = getDefaultAvailityEligibilityConfig()
  if (!raw || typeof raw !== 'object') return defaults
  const obj = raw as Record<string, unknown>
  const resultCapture = (obj.resultCapture || {}) as Record<string, unknown>
  const payerSelection = (obj.payerSelection || {}) as Record<string, unknown>
  const interpretation = (obj.interpretation || {}) as Record<string, unknown>

  const networkFilter =
    resultCapture.networkFilter === 'Out of Network' ||
    resultCapture.networkFilter === 'All Networks' ||
    resultCapture.networkFilter === 'In Network'
      ? resultCapture.networkFilter
      : defaults.resultCapture.networkFilter

  const expandLabels = Array.isArray(resultCapture.expandLabels)
    ? resultCapture.expandLabels
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim())
    : defaults.resultCapture.expandLabels

  const scrollPasses =
    typeof resultCapture.scrollPasses === 'number' && resultCapture.scrollPasses > 0
      ? Math.min(20, Math.floor(resultCapture.scrollPasses))
      : defaults.resultCapture.scrollPasses

  return {
    version: 1,
    resultCapture: {
      networkFilter,
      scrollPasses,
      expandLabels: expandLabels.length ? expandLabels : defaults.resultCapture.expandLabels,
    },
    payerSelection: {
      preferShortBrandFirst:
        typeof payerSelection.preferShortBrandFirst === 'boolean'
          ? payerSelection.preferShortBrandFirst
          : defaults.payerSelection.preferShortBrandFirst,
      rejectMedicareUnlessCrmSaysSo:
        typeof payerSelection.rejectMedicareUnlessCrmSaysSo === 'boolean'
          ? payerSelection.rejectMedicareUnlessCrmSaysSo
          : defaults.payerSelection.rejectMedicareUnlessCrmSaysSo,
    },
    interpretation: {
      requireMemberScopedActiveCoverage:
        typeof interpretation.requireMemberScopedActiveCoverage === 'boolean'
          ? interpretation.requireMemberScopedActiveCoverage
          : defaults.interpretation.requireMemberScopedActiveCoverage,
    },
  }
}

function toRecord(row: {
  id: string
  practiceId: string
  playbookKey: string
  name: string
  site: string
  isActive: boolean
  config: Prisma.JsonValue
  sourceVideoUrl: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): PracticePlaybookRecord {
  return {
    ...row,
    config: normalizeAvailityEligibilityConfig(row.config),
  }
}

export async function getOrCreatePracticePlaybook(
  practiceId: string,
  playbookKey: string = AVAILITY_ELIGIBILITY_PLAYBOOK_KEY
): Promise<PracticePlaybookRecord> {
  const existing = await prisma.practicePlaybook.findUnique({
    where: { practiceId_playbookKey: { practiceId, playbookKey } },
  })
  if (existing) return toRecord(existing)

  const created = await prisma.practicePlaybook.create({
    data: {
      practiceId,
      playbookKey,
      name:
        playbookKey === AVAILITY_ELIGIBILITY_PLAYBOOK_KEY
          ? 'Availity Eligibility & Benefits'
          : playbookKey,
      site: playbookKey.startsWith('availity') ? 'availity' : 'unknown',
      isActive: true,
      config: getDefaultAvailityEligibilityConfig() as unknown as Prisma.InputJsonValue,
    },
  })
  return toRecord(created)
}

export async function getPracticePlaybook(
  practiceId: string,
  playbookKey: string = AVAILITY_ELIGIBILITY_PLAYBOOK_KEY
): Promise<PracticePlaybookRecord | null> {
  const row = await prisma.practicePlaybook.findUnique({
    where: { practiceId_playbookKey: { practiceId, playbookKey } },
  })
  return row ? toRecord(row) : null
}

export async function updatePracticePlaybookConfig(params: {
  practiceId: string
  playbookKey?: string
  config?: unknown
  sourceVideoUrl?: string | null
  notes?: string | null
  isActive?: boolean
  name?: string
}): Promise<PracticePlaybookRecord> {
  const playbookKey = params.playbookKey || AVAILITY_ELIGIBILITY_PLAYBOOK_KEY
  const existing = await getOrCreatePracticePlaybook(params.practiceId, playbookKey)
  const nextConfig =
    params.config !== undefined
      ? normalizeAvailityEligibilityConfig(params.config)
      : existing.config

  const updated = await prisma.practicePlaybook.update({
    where: { id: existing.id },
    data: {
      config: nextConfig as unknown as Prisma.InputJsonValue,
      sourceVideoUrl:
        params.sourceVideoUrl !== undefined ? params.sourceVideoUrl || null : undefined,
      notes: params.notes !== undefined ? params.notes || null : undefined,
      isActive: params.isActive !== undefined ? params.isActive : undefined,
      name: params.name !== undefined ? params.name : undefined,
    },
  })
  return toRecord(updated)
}

export function practicePlaybookConfigFromInput(
  input: Record<string, unknown> | null | undefined
): AvailityEligibilityPlaybookConfig {
  const nested = input?.practicePlaybook
  if (nested && typeof nested === 'object') {
    const cfg = (nested as { config?: unknown }).config
    if (cfg) return normalizeAvailityEligibilityConfig(cfg)
  }
  if (input?.practicePlaybookConfig) {
    return normalizeAvailityEligibilityConfig(input.practicePlaybookConfig)
  }
  return getDefaultAvailityEligibilityConfig()
}
