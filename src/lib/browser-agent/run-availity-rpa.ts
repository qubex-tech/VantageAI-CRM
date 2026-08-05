import { prisma } from '@/lib/db'
import type { ParsedEligibilitySummary } from '@/lib/availity'
import {
  getAvailityIntegrationConfig,
  searchAvailityPayers,
} from '@/lib/availity'
import { markEligibilityCheckFailed } from '@/lib/eligibility/finalize-check'
import {
  normalizePayerText,
  pickBestPayerLabel,
  scorePayerLabel,
} from './playbooks/availity-eligibility'
import {
  AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
  getOrCreatePracticePlaybook,
} from './practice-playbook'
import {
  extractSummaryFromPlaybookOutput,
  finalizeRpaEligibilityCheck,
} from './finalize-rpa-eligibility'
import { executeBrowserAgentRun, startBrowserAgentRun } from './runner'

export interface RunAvailityRpaInput {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  /** When provided, reuse this EligibilityCheck instead of creating a new one */
  eligibilityCheckId?: string
  sync?: boolean
  /** Lonestar appointment type for form mode + call-required flags */
  appointmentType?: string
}

export interface RunAvailityRpaResult {
  started: boolean
  reason?: string
  eligibilityCheckId?: string
  browserAgentRunId?: string
  status?: 'pending' | 'in_progress' | 'complete' | 'failed'
  summary?: ParsedEligibilitySummary
  escalateToVoice?: boolean
}

function formatDob(dob: Date | null | undefined): string {
  if (!dob) return ''
  return dob.toISOString().slice(0, 10)
}

/**
 * When Availity Coverages API credentials are active, resolve CRM payer name →
 * canonical Availity payer id/display name for portal RPA selection.
 * Silent no-op when API is inactive/unconfigured (common for portal-only practices).
 */
export async function resolveAvailityPayerForRpa(params: {
  practiceId: string
  payerNameRaw: string | null | undefined
  availityPayerId: string | null | undefined
}): Promise<{ payerName: string; payerId: string }> {
  const crmName = (params.payerNameRaw || '').trim()
  const existingId = (params.availityPayerId || '').trim()
  const fallback = {
    payerName: crmName,
    payerId: existingId,
  }

  try {
    const integration = await prisma.availityIntegration.findUnique({
      where: { practiceId: params.practiceId },
      select: { isActive: true },
    })
    if (!integration?.isActive) return fallback

    const config = await getAvailityIntegrationConfig(params.practiceId)
    const query = existingId || normalizePayerText(crmName) || crmName
    if (!query) return fallback

    let payers = await searchAvailityPayers(config, query)
    if (!payers.length && crmName && query !== crmName) {
      // Retry with raw CRM label if normalized query missed.
      payers = await searchAvailityPayers(config, crmName)
    }
    if (!payers.length) return fallback

    if (existingId) {
      const byId = payers.find((p) => p.payerId?.toLowerCase() === existingId.toLowerCase())
      if (byId) {
        return {
          payerId: byId.payerId,
          payerName: byId.displayName || byId.name || crmName,
        }
      }
    }

    const labels = payers.map((p) => p.displayName || p.name || p.payerId).filter(Boolean)
    const bestLabel = pickBestPayerLabel(labels, crmName || query)
    if (!bestLabel) {
      // Fall back to highest score against display names, else first hit.
      let best: { payerId: string; payerName: string; score: number } | null = null
      for (const p of payers) {
        const label = p.displayName || p.name || ''
        const score = label ? scorePayerLabel(label, crmName || query) : null
        if (score == null) continue
        if (!best || score > best.score) {
          best = { payerId: p.payerId, payerName: label, score }
        }
      }
      if (best) return { payerId: best.payerId, payerName: best.payerName }
      const first = payers[0]
      return {
        payerId: first.payerId || existingId,
        payerName: first.displayName || first.name || crmName,
      }
    }

    const matched = payers.find((p) => {
      const label = p.displayName || p.name || ''
      return label.trim().toLowerCase() === bestLabel.toLowerCase()
    })
    return {
      payerId: matched?.payerId || existingId,
      payerName: bestLabel,
    }
  } catch {
    return fallback
  }
}

export async function isAvailityRpaAvailable(practiceId: string): Promise<{
  available: boolean
  useMock: boolean
  reason?: string
}> {
  const [integration, credential] = await Promise.all([
    prisma.availityIntegration.findUnique({ where: { practiceId } }),
    prisma.browserCredential.findUnique({
      where: { practiceId_site: { practiceId, site: 'availity' } },
    }),
  ])

  if (!integration?.portalRpaEnabled) {
    return { available: false, useMock: false, reason: 'portal_rpa_disabled' }
  }

  const useMock = integration.portalRpaUseMock || process.env.BROWSER_AGENT_USE_MOCK === '1'
  if (!useMock && (!credential || !credential.isActive)) {
    return { available: false, useMock: false, reason: 'missing_portal_credentials' }
  }

  return { available: true, useMock }
}

/**
 * Start Availity portal RPA eligibility. Returns started:false when not configured.
 */
export async function runAvailityRpaEligibility(
  input: RunAvailityRpaInput
): Promise<RunAvailityRpaResult> {
  const availability = await isAvailityRpaAvailable(input.practiceId)
  if (!availability.available) {
    return { started: false, reason: availability.reason }
  }

  const policy = input.policyId
    ? await prisma.insurancePolicy.findFirst({
        where: {
          id: input.policyId,
          practiceId: input.practiceId,
          patientId: input.patientId,
        },
      })
    : await prisma.insurancePolicy.findFirst({
        where: { practiceId: input.practiceId, patientId: input.patientId },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
      })

  if (!policy) {
    return { started: false, reason: 'no_policy' }
  }

  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, practiceId: input.practiceId, deletedAt: null },
  })
  if (!patient) {
    return { started: false, reason: 'patient_not_found' }
  }

  const [integration, practice] = await Promise.all([
    prisma.availityIntegration.findUnique({
      where: { practiceId: input.practiceId },
    }),
    prisma.practice.findUnique({
      where: { id: input.practiceId },
      select: { name: true },
    }),
  ])

  const resolvedPayer = await resolveAvailityPayerForRpa({
    practiceId: input.practiceId,
    payerNameRaw: policy.payerNameRaw,
    availityPayerId: policy.availityPayerId,
  })

  let checkId = input.eligibilityCheckId
  if (checkId) {
    await prisma.eligibilityCheck.update({
      where: { id: checkId },
      data: {
        source: 'availity_rpa',
        status: 'in_progress',
        errorMessage: null,
      },
    })
  } else {
    const check = await prisma.eligibilityCheck.create({
      data: {
        practiceId: input.practiceId,
        patientId: input.patientId,
        policyId: policy.id,
        source: 'availity_rpa',
        status: 'in_progress',
        requestPayload: {
          memberId: policy.memberId,
          payerName: resolvedPayer.payerName || policy.payerNameRaw,
          payerId: resolvedPayer.payerId || policy.availityPayerId,
          providerNpi: integration?.defaultProviderNpi,
          organizationName: practice?.name,
        },
      },
    })
    checkId = check.id
  }

  const practicePlaybook = await getOrCreatePracticePlaybook(
    input.practiceId,
    AVAILITY_ELIGIBILITY_PLAYBOOK_KEY
  )

  // All patient/payer/practice values come from CRM records — playbook must not hardcode them.
  // Prefer Availity-resolved payer label/id when the Coverages API mapping is available.
  const playbookInput = {
    memberId: policy.memberId,
    groupNumber: policy.groupNumber || '',
    payerName: resolvedPayer.payerName || policy.payerNameRaw || '',
    payerId: resolvedPayer.payerId || policy.availityPayerId || '',
    patientFirstName: patient.firstName || patient.name.split(/\s+/)[0] || '',
    patientLastName:
      patient.lastName || patient.name.split(/\s+/).slice(1).join(' ') || '',
    patientDob: formatDob(patient.dateOfBirth),
    providerNpi: integration?.defaultProviderNpi || '',
    providerTaxId: integration?.defaultProviderTaxId || '',
    organizationName: practice?.name || '',
    serviceType: integration?.defaultServiceType || '30',
    appointmentType: input.appointmentType || '',
    playbookKey: AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
    practicePlaybook: {
      id: practicePlaybook.id,
      playbookKey: practicePlaybook.playbookKey,
      config: practicePlaybook.config,
    },
  }

  const started = await startBrowserAgentRun({
    practiceId: input.practiceId,
    playbookId: practicePlaybook.id,
    input: playbookInput,
    eligibilityCheckId: checkId,
    useMock: availability.useMock,
    sync: input.sync || availability.useMock,
  })

  if (started.result) {
    if (started.result.ok) {
      const summary = extractSummaryFromPlaybookOutput(started.result.output)
      if (summary) {
        const finalized = await finalizeRpaEligibilityCheck({
          eligibilityCheckId: checkId,
          summary,
          rawOutput: started.result.output,
          browserAgentRunId: started.runId,
          appointmentType: input.appointmentType,
        })
        return {
          started: true,
          eligibilityCheckId: checkId,
          browserAgentRunId: started.runId,
          status: finalized.status,
          summary: finalized.summary,
        }
      }
    }

    const reason = started.result.errorMessage || 'Availity portal RPA failed'
    await markEligibilityCheckFailed(checkId, reason)
    return {
      started: true,
      eligibilityCheckId: checkId,
      browserAgentRunId: started.runId,
      status: 'failed',
      escalateToVoice: started.result.escalateToVoice !== false,
      reason,
    }
  }

  return {
    started: true,
    eligibilityCheckId: checkId,
    browserAgentRunId: started.runId,
    status: 'in_progress',
  }
}

/** Called from Inngest after a browser run tied to an eligibility check completes. */
export async function applyBrowserRunToEligibilityCheck(runId: string): Promise<{
  handled: boolean
  escalateToVoice?: boolean
  status?: string
}> {
  const run = await prisma.browserAgentRun.findUnique({ where: { id: runId } })
  if (!run?.eligibilityCheckId) return { handled: false }

  if (run.status === 'complete') {
    const summary = extractSummaryFromPlaybookOutput(run.output as Record<string, unknown>)
    if (!summary) {
      await markEligibilityCheckFailed(run.eligibilityCheckId, 'RPA completed without parseable summary')
      return { handled: true, escalateToVoice: true, status: 'failed' }
    }
    const runInput = (run.input as { appointmentType?: string } | null) || null
    const finalized = await finalizeRpaEligibilityCheck({
      eligibilityCheckId: run.eligibilityCheckId,
      summary,
      rawOutput: (run.output as Record<string, unknown>) || undefined,
      browserAgentRunId: run.id,
      appointmentType: runInput?.appointmentType,
    })
    return { handled: true, status: finalized.status, escalateToVoice: finalized.status === 'failed' }
  }

  if (run.status === 'failed') {
    await markEligibilityCheckFailed(
      run.eligibilityCheckId,
      run.errorMessage || 'Availity portal RPA failed'
    )
    const output = run.output as { escalateToVoice?: boolean } | null
    return {
      handled: true,
      status: 'failed',
      escalateToVoice: output?.escalateToVoice !== false,
    }
  }

  return { handled: false }
}

/** Re-export for Inngest step that needs to execute then apply */
export { executeBrowserAgentRun }
