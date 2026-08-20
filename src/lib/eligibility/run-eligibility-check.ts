import { prisma } from '@/lib/db'
import { inngest } from '@/inngest/client'
import {
  getClearinghouseAdapter,
  getPayerIdForVendor,
  getPracticeEligibilitySettings,
  mapToCanonicalEligibilityRequest,
  resolvePayerIdFromName,
  upsertPayerIdMap,
} from './clearinghouse'
import { computeEligibilityReadiness } from './readiness'
import { finalizeParsedEligibilityCheck } from './finalize-check'

export interface RunEligibilityCheckInput {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  skipInngest?: boolean
  appointmentType?: string
}

export interface RunEligibilityCheckResult {
  eligibilityCheckId: string
  status: 'pending' | 'in_progress' | 'complete' | 'failed'
  coverageId?: string | null
  vendorKey?: string
  vendorDisplayName?: string
  readiness?: { ready: boolean; missingFields: string[]; warnings: string[] }
  summary?: Record<string, unknown>
  errorMessage?: string
}

async function resolvePolicy(practiceId: string, patientId: string, policyId?: string) {
  if (policyId) {
    return prisma.insurancePolicy.findFirst({
      where: { id: policyId, practiceId, patientId },
    })
  }
  const policies = await prisma.insurancePolicy.findMany({
    where: { practiceId, patientId },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
  })
  return policies[0] || null
}

export async function runEligibilityCheck(
  input: RunEligibilityCheckInput
): Promise<RunEligibilityCheckResult> {
  const { practiceId, userId, patientId, policyId } = input

  const [patient, policy, settings, practice] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: patientId, practiceId, deletedAt: null },
    }),
    resolvePolicy(practiceId, patientId, policyId),
    getPracticeEligibilitySettings(practiceId),
    prisma.practice.findUnique({
      where: { id: practiceId },
      select: { name: true },
    }),
  ])

  if (!patient) {
    throw new Error('Patient not found')
  }
  if (!policy) {
    throw new Error('No insurance policy found for patient')
  }

  const adapter = getClearinghouseAdapter(settings.primaryVendorKey)
  const configured = await adapter.isConfigured(practiceId)
  if (!configured) {
    throw new Error(
      `${adapter.displayName} is not configured for this practice. Add credentials in Settings.`
    )
  }

  let payerId = getPayerIdForVendor(policy, adapter.vendorKey)
  let resolvedFromName: { payerId: string; name: string } | null = null
  if (
    !payerId &&
    adapter.vendorKey === 'stedi' &&
    adapter.capabilities.payerSearch &&
    policy.payerNameRaw?.trim()
  ) {
    try {
      const match = await resolvePayerIdFromName({
        payerName: policy.payerNameRaw,
        searchPayers: (query) => adapter.searchPayers(practiceId, query),
      })
      if (match.status === 'matched') {
        payerId = match.payerId
        resolvedFromName = { payerId: match.payerId, name: match.name }
        const payerMap = upsertPayerIdMap(
          policy.clearinghousePayerIds,
          adapter.vendorKey,
          match.payerId
        )
        await prisma.insurancePolicy.update({
          where: { id: policy.id },
          data: { clearinghousePayerIds: payerMap },
        })
        policy.clearinghousePayerIds = payerMap
        console.info('[runEligibilityCheck] Mapped payer name to Stedi ID', {
          practiceId,
          policyId: policy.id,
          payerName: policy.payerNameRaw,
          payerId: match.payerId,
          stediName: match.name,
        })
      } else {
        console.info('[runEligibilityCheck] Could not map payer name to Stedi ID', {
          practiceId,
          policyId: policy.id,
          payerName: policy.payerNameRaw,
          matchStatus: match.status,
          candidates:
            match.status === 'ambiguous'
              ? match.candidates.map((c) => ({ payerId: c.payerId, name: c.name, score: c.score }))
              : undefined,
        })
      }
    } catch (error) {
      console.warn('[runEligibilityCheck] Stedi payer name lookup failed', {
        practiceId,
        policyId: policy.id,
        payerName: policy.payerNameRaw,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const providerNpi = settings.defaultProviderNpi
  const readiness = computeEligibilityReadiness({
    policy,
    patient,
    providerNpi,
    payerId,
    payerIdField: `${adapter.displayName} payer ID`,
    providerOrganizationName:
      adapter.vendorKey === 'stedi'
        ? settings.defaultProviderOrgName || practice?.name || null
        : settings.defaultProviderOrgName,
    requireOrganizationName: adapter.vendorKey === 'stedi',
  })
  if (!payerId && policy.payerNameRaw?.trim()) {
    readiness.warnings.push(
      `Could not uniquely map payer name "${policy.payerNameRaw}" to a ${adapter.displayName} payer ID`
    )
  }

  if (!readiness.ready) {
    return {
      eligibilityCheckId: '',
      status: 'failed',
      vendorKey: adapter.vendorKey,
      vendorDisplayName: adapter.displayName,
      readiness,
      errorMessage: `Missing required fields: ${readiness.missingFields.join(', ')}`,
    }
  }

  const canonical = mapToCanonicalEligibilityRequest({
    practiceId,
    patient,
    policy,
    payerId: payerId!,
    providerNpi: providerNpi!,
    serviceType: settings.defaultServiceType,
    providerOrganizationName: settings.defaultProviderOrgName || practice?.name || null,
    providerTaxId: settings.defaultProviderTaxId,
  })

  const check = await prisma.eligibilityCheck.create({
    data: {
      practiceId,
      patientId,
      policyId: policy.id,
      source: 'clearinghouse_api',
      vendorKey: adapter.vendorKey,
      status: 'pending',
      requestPayload: {
        ...(canonical && {
          payerId: canonical.payerId,
          memberId: `***${canonical.memberId.slice(-4)}`,
          patientFirstName: `${canonical.patientFirstName.slice(0, 1)}***`,
          patientLastName: `${canonical.patientLastName.slice(0, 1)}***`,
          providerNpi: canonical.providerNpi,
          serviceType: canonical.serviceType,
        }),
        vendorKey: adapter.vendorKey,
        appointmentType: input.appointmentType || null,
        resolvedFromName,
        payerNameRaw: policy.payerNameRaw,
      },
    },
  })

  await prisma.insurancePolicy.update({
    where: { id: policy.id },
    data: { eligibilityStatus: 'pending' },
  })

  try {
    const result = await adapter.checkEligibility(canonical)
    const coverageId = result.externalId || null

    await prisma.eligibilityCheck.update({
      where: { id: check.id },
      data: {
        status: result.status === 'in_progress' ? 'in_progress' : 'pending',
        availityCoverageId: coverageId,
        availityStatusCode: result.statusCode || null,
        rawResponse: (result.rawResponse || result.redactedRequest || {}) as object,
        requestPayload: {
          ...(result.redactedRequest || {}),
          vendorKey: adapter.vendorKey,
          appointmentType: input.appointmentType || null,
          resolvedFromName,
          payerNameRaw: policy.payerNameRaw,
        },
      },
    })

    if (result.status === 'complete' && result.summary) {
      const finalized = await finalizeParsedEligibilityCheck({
        eligibilityCheckId: check.id,
        summary: result.summary,
        rawResponse: result.rawResponse || {},
        externalId: coverageId,
        statusCode: result.statusCode,
        sourceLabel: adapter.displayName,
        isTerminalError: false,
        appointmentType: input.appointmentType,
      })
      return {
        eligibilityCheckId: check.id,
        status: finalized.status === 'complete' ? 'complete' : 'failed',
        coverageId,
        vendorKey: adapter.vendorKey,
        vendorDisplayName: adapter.displayName,
        readiness,
        summary: finalized.summary as unknown as Record<string, unknown>,
      }
    }

    if (result.status === 'in_progress') {
      if (!input.skipInngest && coverageId && adapter.capabilities.asyncPoll) {
        await inngest.send({
          name: 'availity/coverage.submitted',
          data: {
            practiceId,
            userId,
            eligibilityCheckId: check.id,
            coverageId,
            appointmentType: input.appointmentType || null,
          },
        })
      }
      return {
        eligibilityCheckId: check.id,
        status: 'in_progress',
        coverageId,
        vendorKey: adapter.vendorKey,
        vendorDisplayName: adapter.displayName,
        readiness,
      }
    }

    const message = result.errorMessage || `${adapter.displayName} eligibility check failed`
    await prisma.eligibilityCheck.update({
      where: { id: check.id },
      data: {
        status: 'failed',
        errorMessage: message,
        parsedSummary: (result.summary || undefined) as object | undefined,
        rawResponse: (result.rawResponse || {}) as object,
        completedAt: new Date(),
      },
    })
    await prisma.insurancePolicy.update({
      where: { id: policy.id },
      data: { eligibilityStatus: 'error' },
    })

    return {
      eligibilityCheckId: check.id,
      status: 'failed',
      coverageId,
      vendorKey: adapter.vendorKey,
      vendorDisplayName: adapter.displayName,
      readiness,
      summary: result.summary as Record<string, unknown> | undefined,
      errorMessage: message,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eligibility check failed'
    await prisma.eligibilityCheck.update({
      where: { id: check.id },
      data: {
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
      },
    })
    await prisma.insurancePolicy.update({
      where: { id: policy.id },
      data: { eligibilityStatus: 'error' },
    })
    throw error
  }
}

export async function pollAndFinalizeEligibilityCheck(params: {
  practiceId: string
  eligibilityCheckId: string
  coverageId: string
  userId?: string
  appointmentType?: string
  triggerVoiceFallback?: (checkId: string, reason: string) => Promise<void>
}) {
  const { getCoverageById, getAvailityIntegrationConfig, isCoverageInProgress } = await import(
    '@/lib/availity'
  )
  const { parseEligibilityResponse } = await import('@/lib/availity')

  const config = await getAvailityIntegrationConfig(params.practiceId)
  const coverage = await getCoverageById(config, params.coverageId)

  await prisma.eligibilityCheck.update({
    where: { id: params.eligibilityCheckId },
    data: {
      availityStatusCode: coverage.statusCode ? String(coverage.statusCode) : null,
      rawResponse: coverage as object,
      status: isCoverageInProgress(coverage) ? 'in_progress' : 'pending',
    },
  })

  if (isCoverageInProgress(coverage)) {
    return { done: false as const, coverage }
  }

  const summary = parseEligibilityResponse(coverage)
  const statusCode = String(coverage.statusCode ?? '')
  const isTerminalError =
    statusCode === '19' ||
    ['7', '13', '14', '15'].includes(statusCode) ||
    summary.eligibilityStatus === 'error'

  const result = await finalizeParsedEligibilityCheck({
    eligibilityCheckId: params.eligibilityCheckId,
    summary,
    rawResponse: coverage as Record<string, unknown>,
    externalId: coverage.id || params.coverageId,
    statusCode,
    sourceLabel: 'Availity',
    isTerminalError,
    triggerVoiceFallback: params.triggerVoiceFallback,
    appointmentType: params.appointmentType,
  })

  return { done: true as const, result, coverage }
}
