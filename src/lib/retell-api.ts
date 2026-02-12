/**
 * RetellAI API Client
 * 
 * Client for interacting with RetellAI API to fetch call information
 * Documentation: https://docs.retellai.com/api-references/get-call
 */

export interface RetellCall {
  call_id: string
  call_type: 'phone_call' | 'web_call'
  agent_id: string
  agent_name?: string
  call_status: string
  start_timestamp?: number
  end_timestamp?: number
  duration_ms?: number
  transcript?: string
  transcript_object?: any[]
  transcript_with_tool_calls?: any[]
  call_analysis?: {
    call_summary?: string
    user_sentiment?: string
    call_successful?: boolean
    in_voicemail?: boolean
    custom_analysis_data?: any
  }
  recording_url?: string
  recording_multi_channel_url?: string
  public_log_url?: string
  disconnection_reason?: string
  transfer_destination?: string
  metadata?: Record<string, any>
}

export interface RetellCallListItem {
  call_id: string
  call_type: 'phone_call' | 'web_call'
  agent_id: string
  call_status: string
  start_timestamp?: number
  end_timestamp?: number
  duration_ms?: number
}

export interface RetellIntegrationConfig {
  practiceId: string
  apiKey: string
  agentId: string | null
  mcpBaseUrl: string | null
  mcpApiKey: string | null
  mcpActorId: string | null
  mcpRequestIdPrefix: string | null
  outboundToolName: string | null
}

export class RetellApiClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = 'https://api.retellai.com/v2') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * Get a list of calls
   * Documentation: https://docs.retellai.com/api-references/list-calls
   */
  async listCalls(params?: {
    agentId?: string
    limit?: number
    offset?: number
    startTimestamp?: number
    endTimestamp?: number
  }): Promise<{ calls: RetellCallListItem[], total?: number }> {
    try {
      // Build request body according to RetellAI API documentation
      const body: any = {}
      
      if (params?.agentId) {
        body.filter_criteria = {
          agent_id: [params.agentId]
        }
      }
      
      if (params?.limit) {
        body.limit = params.limit
      }
      
      // Note: RetellAI API uses pagination_key instead of offset
      // For now, we'll ignore offset as pagination_key requires a call_id
      
      const url = `${this.baseUrl}/list-calls`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('RetellAI list calls API error response:', errorText)
        let errorMessage = `RetellAI API error: ${response.status} ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message) {
            errorMessage = typeof errorJson.message === 'string' 
              ? errorJson.message 
              : JSON.stringify(errorJson.message)
          } else if (errorJson.error) {
            errorMessage = typeof errorJson.error === 'string'
              ? errorJson.error
              : JSON.stringify(errorJson.error)
          }
        } catch (parseError) {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // RetellAI API returns calls in a list format
      if (Array.isArray(data)) {
        return { calls: data }
      } else if (data.calls && Array.isArray(data.calls)) {
        return { calls: data.calls, total: data.total }
      }
      
      throw new Error('Invalid response format from RetellAI list calls API')
    } catch (error) {
      console.error('Error listing RetellAI calls:', error)
      throw error
    }
  }

  /**
   * Get details of a specific call
   * Documentation: https://docs.retellai.com/api-references/get-call
   */
  async getCall(callId: string): Promise<RetellCall> {
    try {
      const response = await fetch(`${this.baseUrl}/get-call/${callId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('RetellAI get call API error response:', errorText)
        let errorMessage = `RetellAI API error: ${response.status} ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message) {
            errorMessage = typeof errorJson.message === 'string' 
              ? errorJson.message 
              : JSON.stringify(errorJson.message)
          } else if (errorJson.error) {
            errorMessage = typeof errorJson.error === 'string'
              ? errorJson.error
              : JSON.stringify(errorJson.error)
          }
        } catch (parseError) {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      return data as RetellCall
    } catch (error) {
      console.error('Error fetching RetellAI call:', error)
      throw error
    }
  }

  /**
   * Create an outbound phone call.
   * Docs: https://docs.retellai.com/api-references/create-phone-call
   */
  async createPhoneCall(params: {
    fromNumber: string
    toNumber: string
    overrideAgentId?: string
    metadata?: Record<string, unknown>
    dynamicVariables?: Record<string, string>
  }): Promise<{ call_id?: string; [key: string]: unknown }> {
    const response = await fetch(`${this.baseUrl}/create-phone-call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: params.fromNumber,
        to_number: params.toNumber,
        override_agent_id: params.overrideAgentId,
        metadata: params.metadata,
        retell_llm_dynamic_variables: params.dynamicVariables,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Retell create-phone-call failed (${response.status}): ${errorText || response.statusText}`)
    }
    return response.json()
  }
}

/**
 * Load Retell integration settings for a practice.
 */
export async function getRetellIntegrationConfig(practiceId: string): Promise<RetellIntegrationConfig> {
  const { prisma } = await import('./db')

  const integration = await prisma.retellIntegration.findUnique({
    where: { practiceId },
  })

  if (!integration || !integration.isActive) {
    throw new Error('RetellAI integration not configured for this practice. Please configure it in Settings.')
  }

  return {
    practiceId,
    apiKey: integration.apiKey,
    agentId: integration.agentId ?? null,
    mcpBaseUrl: integration.mcpBaseUrl ?? null,
    mcpApiKey: integration.mcpApiKey ?? null,
    mcpActorId: integration.mcpActorId ?? null,
    mcpRequestIdPrefix: integration.mcpRequestIdPrefix ?? null,
    outboundToolName: integration.outboundToolName ?? null,
  }
}

/**
 * Get RetellAI client for a practice.
 */
export async function getRetellClient(practiceId: string): Promise<RetellApiClient> {
  const integration = await getRetellIntegrationConfig(practiceId)
  return new RetellApiClient(integration.apiKey)
}

type JsonRpcResponse<T = any> = {
  jsonrpc?: string
  id?: string | number | null
  result?: T
  error?: { code?: number; message?: string; data?: unknown }
}

function getDefaultAppBaseUrl(): string | null {
  const appBaseUrl = process.env.APP_BASE_URL?.trim()
  if (appBaseUrl) return appBaseUrl

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim()
  if (nextAuthUrl) return nextAuthUrl

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`
  }

  return null
}

function getDefaultMcpApiKey(): string | null {
  const configuredSingle = process.env.MCP_API_KEY?.trim()
  if (configuredSingle) return configuredSingle

  const configuredKeys = (process.env.MCP_API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  return configuredKeys[0] ?? null
}

function normalizeMcpBaseUrl(rawBaseUrl: string): string {
  const url = new URL(rawBaseUrl)
  let path = url.pathname.replace(/\/+$/, '') || ''

  // Accept legacy MCP resource URLs and normalize them to the JSON-RPC endpoint.
  if (path.endsWith('/tools') || path.endsWith('/health') || path.endsWith('/call')) {
    path = path.replace(/\/(tools|health|call)$/, '')
  }
  if (path.startsWith('/api/mcp')) {
    path = '/mcp'
  }
  if (!path || path === '/') {
    path = '/mcp'
  }

  if (path !== '/mcp') {
    path = '/mcp'
  }

  url.pathname = path
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

function buildMcpHeaders(config: RetellIntegrationConfig, requestId: string): HeadersInit {
  const resolvedApiKey = config.mcpApiKey?.trim() || getDefaultMcpApiKey()
  const resolvedActorId = config.mcpActorId?.trim() || 'healix-outbound'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
  }
  if (resolvedApiKey) headers['x-api-key'] = resolvedApiKey
  if (resolvedActorId) headers['x-actor-id'] = resolvedActorId
  return headers
}

async function postJsonRpc<T = unknown>(
  url: string,
  body: Record<string, unknown>,
  headers: HeadersInit
): Promise<JsonRpcResponse<T>> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`MCP request failed (${response.status}): ${errorText || response.statusText}`)
  }
  return response.json()
}

async function executeLocalFallbackTool(params: {
  config: RetellIntegrationConfig
  toolName: string
  args: Record<string, unknown>
}): Promise<{ rawResult: unknown; callId?: string | null }> {
  const { config, toolName, args } = params

  if (toolName === 'create_outbound_call') {
    const toNumber = (args.to_number as string | undefined)?.trim()
    if (!toNumber) {
      throw new Error('create_outbound_call requires to_number')
    }
    const fromNumber =
      (args.from_number as string | undefined)?.trim() ||
      process.env.RETELL_FROM_NUMBER?.trim() ||
      ''
    if (!fromNumber) {
      throw new Error('RETELL_FROM_NUMBER is not configured for outbound call fallback')
    }

    const client = new RetellApiClient(config.apiKey)
    const response = await client.createPhoneCall({
      fromNumber,
      toNumber,
      overrideAgentId: (args.agent_id as string | undefined)?.trim() || config.agentId || undefined,
      metadata: (args.context as Record<string, unknown> | undefined) || undefined,
      dynamicVariables: {
        patient_context: JSON.stringify((args.context as Record<string, unknown> | undefined) || {}),
      },
    })
    const callId = typeof response.call_id === 'string' ? response.call_id : null
    return { rawResult: response, callId }
  }

  const { invokeTool } = await import('@/lib/mcp/registry')
  const result = await invokeTool(
    toolName,
    args,
    {
      requestId: `local-mcp-${Date.now()}`,
      actorId: 'system',
      actorType: 'system',
      purpose: 'local fallback execution',
      allowUnmasked: false,
    }
  )
  if (result.error) {
    throw new Error(result.error.message)
  }
  return { rawResult: result.output, callId: null }
}

export async function callRetellMcpTool(params: {
  config: RetellIntegrationConfig
  toolName: string
  args: Record<string, unknown>
}): Promise<{ rawResult: unknown; callId?: string | null }> {
  const { config, toolName, args } = params
  const configuredBaseUrl = config.mcpBaseUrl?.trim() || ''
  if (!configuredBaseUrl) {
    return executeLocalFallbackTool({ config, toolName, args })
  }

  const fallbackBaseUrl = getDefaultAppBaseUrl()
  const resolvedBaseUrl = configuredBaseUrl || fallbackBaseUrl || ''

  if (!resolvedBaseUrl) {
    throw new Error('Retell MCP base URL is not configured in settings and no APP_BASE_URL/NEXTAUTH_URL fallback is available.')
  }

  const requestIdPrefix = config.mcpRequestIdPrefix || 'healix-outbound'
  const requestId = `${requestIdPrefix}-${Date.now()}`
  const headers = buildMcpHeaders(config, requestId)
  const url = normalizeMcpBaseUrl(resolvedBaseUrl)
  const rpcId = `rpc-${Date.now()}`

  // Best-effort initialize handshake for MCP servers that expect lifecycle calls.
  await postJsonRpc(url, { jsonrpc: '2.0', id: `${rpcId}-init`, method: 'initialize', params: {} }, headers).catch(() => null)

  const callResponse = await postJsonRpc<{
    content?: unknown
    output?: Record<string, unknown>
    call_id?: string
    callId?: string
    id?: string
  }>(
    url,
    {
      jsonrpc: '2.0',
      id: `${rpcId}-call`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    },
    headers
  )

  if (callResponse.error) {
    throw new Error(callResponse.error.message || 'MCP tools/call failed')
  }

  const result = callResponse.result ?? null
  const resultObj = typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : null
  const output = (resultObj?.output && typeof resultObj.output === 'object'
    ? (resultObj.output as Record<string, unknown>)
    : resultObj) || {}
  const callId =
    (typeof output.call_id === 'string' && output.call_id) ||
    (typeof output.callId === 'string' && output.callId) ||
    (typeof output.id === 'string' && output.id) ||
    null

  return { rawResult: result, callId }
}

