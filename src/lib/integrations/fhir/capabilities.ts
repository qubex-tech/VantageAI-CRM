export type ResourceInteraction =
  | 'read'
  | 'search-type'
  | 'create'
  | 'update'
  | 'patch'
  | 'delete'

type CapabilityStatement = {
  rest?: Array<{
    resource?: Array<{
      type?: string
      interaction?: Array<{ code?: string }>
    }>
    security?: {
      extension?: Array<{
        url?: string
        extension?: Array<{ url?: string; valueUri?: string }>
      }>
    }
  }>
}

export type SmartOAuthUris = {
  authorizationEndpoint?: string
  tokenEndpoint?: string
  revocationEndpoint?: string
}

export function extractSmartOAuthUris(capabilityStatement: CapabilityStatement): SmartOAuthUris | null {
  const securityExtensions = capabilityStatement.rest?.[0]?.security?.extension || []
  const smartExtension = securityExtensions.find(
    (ext) => ext.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris'
  )

  if (!smartExtension?.extension) {
    return null
  }

  const getUri = (url: string) =>
    smartExtension.extension?.find((entry) => entry.url === url)?.valueUri

  return {
    authorizationEndpoint: getUri('authorize'),
    tokenEndpoint: getUri('token'),
    revocationEndpoint: getUri('revoke'),
  }
}

export function extractResourceInteractions(
  capabilityStatement: CapabilityStatement
): Record<string, Set<ResourceInteraction>> {
  const resources = capabilityStatement.rest?.[0]?.resource || []
  const interactions: Record<string, Set<ResourceInteraction>> = {}

  for (const resource of resources) {
    if (!resource.type) {
      continue
    }
    const supported = new Set<ResourceInteraction>()
    for (const interaction of resource.interaction || []) {
      const code = interaction.code as ResourceInteraction | undefined
      if (code) {
        supported.add(code)
      }
    }
    interactions[resource.type] = supported
  }

  return interactions
}

export function supportsResourceInteraction(
  capabilityStatement: CapabilityStatement,
  resourceType: string,
  interaction: ResourceInteraction
): boolean {
  const interactions = extractResourceInteractions(capabilityStatement)
  return interactions[resourceType]?.has(interaction) ?? false
}

export function summarizeCapabilities(
  capabilityStatement: CapabilityStatement,
  resourceTypes: string[] = ['Patient', 'DocumentReference', 'Binary']
) {
  const interactions = extractResourceInteractions(capabilityStatement)
  return resourceTypes.map((resourceType) => ({
    resourceType,
    interactions: Array.from(interactions[resourceType] || []).sort(),
  }))
}
