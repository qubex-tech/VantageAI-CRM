/**
 * Inbound vs outbound classification for VoiceConversation rows (analytics, reporting).
 */

export type InboundClassificationInput = {
  outcome: string | null
  metadata: unknown
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

/**
 * Inbound agent product calls: default yes for legacy rows, exclude explicit outbound
 * (insurance MCP) and Retell-marked outbound.
 */
export function isInboundAgentCall(row: InboundClassificationInput): boolean {
  if (row.outcome === 'outbound_insurance_verification_initiated') {
    return false
  }
  const meta = metadataRecord(row.metadata)
  if (meta.retell_call_direction === 'outbound') {
    return false
  }
  return true
}
