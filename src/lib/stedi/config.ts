import { prisma } from '@/lib/db'
import { decryptString } from '@/lib/integrations/ehr/crypto'
import type { StediEnvironment, StediIntegrationConfig } from './types'

export const DEFAULT_STEDI_API_BASE = 'https://healthcare.us.stedi.com/2024-04-01'

function envStediApiKey(): string | null {
  const key = process.env.STEDI_API_KEY?.trim()
  return key || null
}

export function hasPlatformStediApiKey(): boolean {
  return Boolean(envStediApiKey())
}

function decryptApiKey(payload: string | null | undefined): string | null {
  if (!payload?.trim()) return null
  try {
    return decryptString(payload)
  } catch {
    return payload
  }
}

export async function getStediIntegrationConfig(
  practiceId: string
): Promise<StediIntegrationConfig> {
  const integration = await prisma.stediIntegration.findUnique({
    where: { practiceId },
  })

  if (!integration) {
    throw new Error('Eligibility is not configured for this practice. Add an API key in Settings.')
  }

  const environment = integration.environment === 'production' ? 'production' : 'test'

  return {
    practiceId,
    apiKey: decryptApiKey(integration.apiKeyEnc) || envStediApiKey(),
    environment,
    apiBaseUrl: integration.apiBaseUrl?.trim() || DEFAULT_STEDI_API_BASE,
    useMockResponses: integration.useMockResponses,
    isActive: integration.isActive,
  }
}

export async function getOrCreateStediIntegration(practiceId: string) {
  return prisma.stediIntegration.upsert({
    where: { practiceId },
    create: {
      practiceId,
      useMockResponses: true,
      isActive: false,
      environment: 'test',
    },
    update: {},
  })
}

export async function isStediConfigured(practiceId: string): Promise<boolean> {
  const integration = await prisma.stediIntegration.findUnique({
    where: { practiceId },
    select: { isActive: true, apiKeyEnc: true, useMockResponses: true },
  })
  if (!integration?.isActive) return false
  if (integration.useMockResponses) return true
  return Boolean(integration.apiKeyEnc) || hasPlatformStediApiKey()
}
