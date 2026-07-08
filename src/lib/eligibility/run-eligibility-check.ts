import { prisma } from '@/lib/db'
import { inngest } from '@/inngest/client'
import {
  getAvailityIntegrationConfig,
  getCoverageById,
  isCoverageInProgress,
  mapToCoverageInquiryRequest,
  redactCoverageRequest,
  submitCoverageInquiry,
} from '@/lib/availity'
import { computeEligibilityReadiness } from './readiness'
import { finalizeEligibilityCheck } from './finalize-check'

export interface RunEligibilityCheckInput {
  practiceId: string
  userId: string
  patientId: string
  policyId?: string
  skipInngest?: boolean
}

export interface RunEligibilityCheckResult {
  eligibilityCheckId: string
  status: 'pending' | 'in_progress' | 'complete' | 'failed'
  coverageId?: string | null
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

  const [patient, policy, config] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: patientId, practiceId, deletedAt: null },
    }),
    resolvePolicy(practiceId, patientId, policyId),
    getAvailityIntegrationConfig(practiceId).catch(() => null),
  ])

  if (!patient) {
    throw new Error('Patient not found')
  }
  if (!policy) {
    throw new Error('No insurance policy found for patient')
  }
  if (!config) {
    throw new Error('Availity integration is not configured for this practice')
  }

  const readiness = computeEligibilityReadiness({
    policy,
    patient,
    providerNpi: config.defaultProviderNpi,
  })

  if (!readiness.ready) {
    return {
      eligibilityCheckId: '',
      status: 'failed',
      readiness,
      errorMessage: `Missing required fields: ${readiness.missingFields.join(', ')}`,
    }
  }

  const request = mapToCoverageInquiryRequest({
    patient,
    policy,
    payerId: policy.availityPayerId!,
    providerNpi: config.defaultProviderNpi!,
    serviceType: config.defaultServiceType,
    providerTaxId: config.defaultProviderTaxId,
    submitterId: config.submitterId,
  })

  const check = await prisma.eligibilityCheck.create({
    data: {
      practiceId,
      patientId,
      policyId: policy.id,
      source: 'availity_api',
      status: 'pending',
      requestPayload: redactCoverageRequest(request),
    },
  })

  await prisma.insurancePolicy.update({
    where: { id: policy.id },
    data: { eligibilityStatus: 'pending' },
  })

  try {
    const submission = await submitCoverageInquiry(config, request)
    const coverageId = submission.id || null

    await prisma.eligibilityCheck.update({
      where: { id: check.id },
      data: {
        status: isCoverageInProgress(submission) ? 'in_progress' : 'pending',
        availityCoverageId: coverageId,
        availityStatusCode: submission.statusCode ? String(submission.statusCode) : null,
        rawResponse: submission as object,
      },
    })

    if (!isCoverageInProgress(submission)) {
      const result = await finalizeEligibilityCheck({
        eligibilityCheckId: check.id,
        coverage: submission,
      })
      return {
        eligibilityCheckId: check.id,
        status: result.status === 'complete' ? 'complete' : 'failed',
        coverageId,
        readiness,
        summary: result.summary as unknown as Record<string, unknown>,
      }
    }

    if (!input.skipInngest && coverageId) {
      await inngest.send({
        name: 'availity/coverage.submitted',
        data: {
          practiceId,
          userId,
          eligibilityCheckId: check.id,
          coverageId,
        },
      })
    }

    return {
      eligibilityCheckId: check.id,
      status: 'in_progress',
      coverageId,
      readiness,
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
  triggerVoiceFallback?: (checkId: string, reason: string) => Promise<void>
}) {
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

  const result = await finalizeEligibilityCheck({
    eligibilityCheckId: params.eligibilityCheckId,
    coverage,
    triggerVoiceFallback: params.triggerVoiceFallback,
  })

  return { done: true as const, result, coverage }
}
