import { prisma } from '@/lib/db'
import { decryptString } from '@/lib/integrations/ehr/crypto'
import type { AvailityEnvironment, AvailityIntegrationConfig } from './types'

const DEFAULT_API_BASE = 'https://api.availity.com/availity/v1'
const DEFAULT_TOKEN_URL = 'https://api.availity.com/v1/token'

function resolveOAuthScope(environment: AvailityEnvironment): string {
  if (environment === 'production') {
    return 'healthcare-hipaa-transactions'
  }
  return 'healthcare-hipaa-transactions healthcare-hipaa-transactions-demo'
}

function decryptClientSecret(payload: string | null | undefined): string | null {
  if (!payload?.trim()) return null
  try {
    return decryptString(payload)
  } catch {
    return payload
  }
}

export async function getAvailityIntegrationConfig(
  practiceId: string
): Promise<AvailityIntegrationConfig> {
  let integration = await prisma.availityIntegration.findUnique({
    where: { practiceId },
  })

  if (!integration) {
    integration = await getOrCreateAvailityIntegration(practiceId)
  }

  if (!integration.isActive) {
    throw new Error(
      'Availity integration is not configured for this practice. Configure it in Settings.'
    )
  }

  const environment = (integration.environment === 'production' ? 'production' : 'demo') as AvailityEnvironment

  return {
    practiceId,
    clientId: integration.clientId ?? null,
    clientSecret: decryptClientSecret(integration.clientSecretEnc),
    environment,
    apiBaseUrl: integration.apiBaseUrl?.trim() || DEFAULT_API_BASE,
    tokenUrl: DEFAULT_TOKEN_URL,
    defaultProviderNpi: integration.defaultProviderNpi ?? null,
    defaultProviderTaxId: integration.defaultProviderTaxId ?? null,
    defaultServiceType: integration.defaultServiceType || '30',
    submitterId: integration.submitterId ?? null,
    submitterStateCode: integration.submitterStateCode ?? null,
    useMockResponses: integration.useMockResponses,
    isActive: integration.isActive,
    oauthScope: resolveOAuthScope(environment),
  }
}

export async function getOrCreateAvailityIntegration(practiceId: string) {
  return prisma.availityIntegration.upsert({
    where: { practiceId },
    create: {
      practiceId,
      useMockResponses: true,
      isActive: true,
      environment: 'demo',
    },
    update: {},
  })
}
