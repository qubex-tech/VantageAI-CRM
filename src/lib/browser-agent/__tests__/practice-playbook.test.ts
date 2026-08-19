import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const create = vi.fn()
const update = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    practicePlaybook: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}))

import {
  AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
  getDefaultAvailityEligibilityConfig,
  getOrCreatePracticePlaybook,
  isLlmAssistEnabled,
  normalizeAvailityEligibilityConfig,
  practicePlaybookConfigFromInput,
} from '../practice-playbook'

describe('getDefaultAvailityEligibilityConfig', () => {
  it('returns version 1 with expected capture defaults', () => {
    const config = getDefaultAvailityEligibilityConfig()
    expect(config.version).toBe(1)
    expect(config.inquiry.providerType).toBe('Professional')
    expect(config.inquiry.benefitServiceType).toBe(
      'Professional (Physician) Visit - Office - 98'
    )
    expect(config.resultCapture.networkFilter).toBe('In Network')
    expect(config.resultCapture.scrollPasses).toBe(6)
    expect(config.resultCapture.expandLabels).toContain('Benefit Information')
    expect(config.resultCapture.expandLabels).toContain('Specialist')
    expect(config.payerSelection.preferShortBrandFirst).toBe(true)
    expect(config.interpretation.requireMemberScopedActiveCoverage).toBe(true)
  })
})

describe('normalizeAvailityEligibilityConfig', () => {
  it('fills missing fields from defaults', () => {
    const normalized = normalizeAvailityEligibilityConfig({
      resultCapture: { networkFilter: 'Out of Network', expandLabels: ['Specialist'] },
    })
    expect(normalized.resultCapture.networkFilter).toBe('Out of Network')
    expect(normalized.resultCapture.expandLabels).toEqual(['Specialist'])
    expect(normalized.resultCapture.scrollPasses).toBe(6)
    expect(normalized.version).toBe(1)
  })

  it('rejects invalid network filter and empty expand labels', () => {
    const normalized = normalizeAvailityEligibilityConfig({
      resultCapture: { networkFilter: 'Nope', expandLabels: ['', '  '] },
    })
    expect(normalized.resultCapture.networkFilter).toBe('In Network')
    expect(normalized.resultCapture.expandLabels).toEqual(
      getDefaultAvailityEligibilityConfig().resultCapture.expandLabels
    )
  })

  it('keeps llmAssist disabled for existing rows without the key', () => {
    const normalized = normalizeAvailityEligibilityConfig({
      resultCapture: { networkFilter: 'In Network' },
    })
    expect(normalized.llmAssist.enabled).toBe(false)
    expect(normalized.llmAssist.model).toBe('openai/gpt-4.1-mini')
  })

  it('honors llmAssist.enabled when present', () => {
    const on = normalizeAvailityEligibilityConfig({
      llmAssist: { enabled: true, model: 'openai/gpt-4.1' },
    })
    expect(on.llmAssist.enabled).toBe(true)
    expect(on.llmAssist.model).toBe('openai/gpt-4.1')

    const off = normalizeAvailityEligibilityConfig({
      llmAssist: { enabled: false },
    })
    expect(off.llmAssist.enabled).toBe(false)
  })
})

describe('getDefaultAvailityEligibilityConfig llmAssist', () => {
  it('defaults llmAssist enabled for new configs', () => {
    const config = getDefaultAvailityEligibilityConfig()
    expect(config.llmAssist.enabled).toBe(true)
    expect(config.llmAssist.model).toBe('openai/gpt-4.1-mini')
  })
})

describe('isLlmAssistEnabled', () => {
  const prev = process.env.BROWSER_AGENT_LLM

  afterEach(() => {
    if (prev === undefined) delete process.env.BROWSER_AGENT_LLM
    else process.env.BROWSER_AGENT_LLM = prev
  })

  it('respects env force-off even when config enabled', () => {
    process.env.BROWSER_AGENT_LLM = '0'
    expect(
      isLlmAssistEnabled({
        ...getDefaultAvailityEligibilityConfig(),
        llmAssist: { enabled: true },
      })
    ).toBe(false)
  })

  it('uses config when env unset', () => {
    delete process.env.BROWSER_AGENT_LLM
    expect(
      isLlmAssistEnabled({
        ...getDefaultAvailityEligibilityConfig(),
        llmAssist: { enabled: false },
      })
    ).toBe(false)
    expect(
      isLlmAssistEnabled({
        ...getDefaultAvailityEligibilityConfig(),
        llmAssist: { enabled: true },
      })
    ).toBe(true)
  })
})

describe('practicePlaybookConfigFromInput', () => {
  it('reads nested practicePlaybook.config', () => {
    const config = practicePlaybookConfigFromInput({
      practicePlaybook: {
        config: {
          resultCapture: { networkFilter: 'All Networks', expandLabels: ['Medical Care - 1'] },
        },
      },
    })
    expect(config.resultCapture.networkFilter).toBe('All Networks')
    expect(config.resultCapture.expandLabels).toEqual(['Medical Care - 1'])
  })

  it('falls back to defaults when missing', () => {
    expect(practicePlaybookConfigFromInput({})).toEqual(getDefaultAvailityEligibilityConfig())
  })
})

describe('getOrCreatePracticePlaybook', () => {
  beforeEach(() => {
    findUnique.mockReset()
    create.mockReset()
    update.mockReset()
  })

  it('returns existing playbook without creating', async () => {
    const row = {
      id: 'pb-1',
      practiceId: 'practice-1',
      playbookKey: AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
      name: 'Availity Eligibility & Benefits',
      site: 'availity',
      isActive: true,
      config: getDefaultAvailityEligibilityConfig(),
      sourceVideoUrl: null,
      notes: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    }
    findUnique.mockResolvedValue(row)

    const result = await getOrCreatePracticePlaybook('practice-1')
    expect(result.id).toBe('pb-1')
    expect(create).not.toHaveBeenCalled()
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        practiceId_playbookKey: {
          practiceId: 'practice-1',
          playbookKey: AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
        },
      },
    })
  })

  it('creates a default playbook when missing', async () => {
    findUnique.mockResolvedValue(null)
    const created = {
      id: 'pb-new',
      practiceId: 'practice-2',
      playbookKey: AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
      name: 'Availity Eligibility & Benefits',
      site: 'availity',
      isActive: true,
      config: getDefaultAvailityEligibilityConfig(),
      sourceVideoUrl: null,
      notes: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }
    create.mockResolvedValue(created)

    const result = await getOrCreatePracticePlaybook('practice-2')
    expect(result.id).toBe('pb-new')
    expect(create).toHaveBeenCalledTimes(1)
    const createArg = create.mock.calls[0][0]
    expect(createArg.data.practiceId).toBe('practice-2')
    expect(createArg.data.playbookKey).toBe(AVAILITY_ELIGIBILITY_PLAYBOOK_KEY)
    expect(createArg.data.config.version).toBe(1)
  })
})
