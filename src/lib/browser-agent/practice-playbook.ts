import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const AVAILITY_ELIGIBILITY_PLAYBOOK_KEY = 'availity.eligibility'

export type AvailityNetworkFilter = 'In Network' | 'Out of Network' | 'All Networks'

export type AvailityEligibilityPlaybookConfig = {
  version: 1
  /** Form fields filled before Submit (Lonestar handbook / practice SOP). */
  inquiry: {
    /** Always Professional for specialist clinic inquiries (not Hospital). */
    providerType: string
    /**
     * Availity Benefit / Service Type label.
     * Lonestar: Professional (Physician) Visit - Office - 98
     */
    benefitServiceType: string
    placeOfService?: string
  }
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
  /** Hybrid Stagehand LLM assist for brittle Availity UI steps + result extract. */
  llmAssist: {
    enabled: boolean
    /** Stagehand model id, e.g. openai/gpt-4.1-mini */
    model?: string
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

export const DEFAULT_AVAILITY_BENEFIT_SERVICE_TYPE =
  'Professional (Physician) Visit - Office - 98'

export function getDefaultAvailityEligibilityConfig(): AvailityEligibilityPlaybookConfig {
  return {
    version: 1,
    inquiry: {
      providerType: 'Professional',
      benefitServiceType: DEFAULT_AVAILITY_BENEFIT_SERVICE_TYPE,
    },
    resultCapture: {
      networkFilter: 'In Network',
      scrollPasses: 6,
      expandLabels: [
        'Benefit Information',
        'Expand',
        'Professional (Physician) Visit - Office',
        'Professional (Physician) Visit - Office - 98',
        'Professional (Physician) - 96',
        'Telemedicine Specialist Visit',
        'Telemedicine Specialist Visit,COPAY INCLUDED IN OOP',
        'Specialist',
        'Office Visit',
        'Medical Care - 1',
        'Health Benefit Plan Coverage',
        'Co-Insurance',
        'Co-Payment',
        'Authorization',
        'Limitations',
      ],
    },
    payerSelection: {
      preferShortBrandFirst: true,
      rejectMedicareUnlessCrmSaysSo: true,
    },
    interpretation: {
      requireMemberScopedActiveCoverage: true,
    },
    llmAssist: {
      enabled: true,
      model: 'openai/gpt-4.1-mini',
    },
  }
}

export function normalizeAvailityEligibilityConfig(
  raw: unknown
): AvailityEligibilityPlaybookConfig {
  const defaults = getDefaultAvailityEligibilityConfig()
  if (!raw || typeof raw !== 'object') return defaults
  const obj = raw as Record<string, unknown>
  const inquiry = (obj.inquiry || {}) as Record<string, unknown>
  const resultCapture = (obj.resultCapture || {}) as Record<string, unknown>
  const payerSelection = (obj.payerSelection || {}) as Record<string, unknown>
  const interpretation = (obj.interpretation || {}) as Record<string, unknown>
  const llmAssistRaw = (obj.llmAssist || {}) as Record<string, unknown>
  const hasLlmAssistKey = Object.prototype.hasOwnProperty.call(obj, 'llmAssist')

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

  const benefitServiceType =
    typeof inquiry.benefitServiceType === 'string' && inquiry.benefitServiceType.trim()
      ? inquiry.benefitServiceType.trim()
      : defaults.inquiry.benefitServiceType
  const providerType =
    typeof inquiry.providerType === 'string' && inquiry.providerType.trim()
      ? inquiry.providerType.trim()
      : defaults.inquiry.providerType
  const placeOfService =
    typeof inquiry.placeOfService === 'string' && inquiry.placeOfService.trim()
      ? inquiry.placeOfService.trim()
      : defaults.inquiry.placeOfService

  return {
    version: 1,
    inquiry: {
      providerType,
      benefitServiceType,
      ...(placeOfService ? { placeOfService } : {}),
    },
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
    // Existing DB rows without llmAssist stay off until Settings enables them.
    llmAssist: {
      enabled: hasLlmAssistKey
        ? typeof llmAssistRaw.enabled === 'boolean'
          ? llmAssistRaw.enabled
          : defaults.llmAssist.enabled
        : false,
      model:
        typeof llmAssistRaw.model === 'string' && llmAssistRaw.model.trim()
          ? llmAssistRaw.model.trim()
          : defaults.llmAssist.model,
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

/** Whether hybrid Stagehand assist should run for this playbook config / env. */
export function isLlmAssistEnabled(config: AvailityEligibilityPlaybookConfig): boolean {
  if (process.env.BROWSER_AGENT_LLM === '0' || process.env.BROWSER_AGENT_LLM === 'false') {
    return false
  }
  if (process.env.BROWSER_AGENT_LLM === '1' || process.env.BROWSER_AGENT_LLM === 'true') {
    return true
  }
  return Boolean(config.llmAssist?.enabled)
}
