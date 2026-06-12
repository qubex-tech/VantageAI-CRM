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
  from_number?: string
  to_number?: string
  direction?: 'inbound' | 'outbound'
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
  insuranceVerificationAgentId: string | null
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

  private buildListCallsRequestBodies(params?: {
    agentId?: string
    limit?: number
    startTimestamp?: number
    endTimestamp?: number
    paginationKey?: string
    directionInboundOnly?: boolean
    includeTotal?: boolean
  }): { v3: Record<string, unknown>; v2: Record<string, unknown> } {
    const shared: Record<string, unknown> = {
      sort_order: 'descending',
    }
    if (params?.limit) shared.limit = params.limit
    if (params?.paginationKey) shared.pagination_key = params.paginationKey
    if (params?.includeTotal) shared.include_total = true

    const v3Filter: Record<string, unknown> = {}
    const v2Filter: Record<string, unknown> = {}

    if (params?.agentId) {
      v3Filter.agent = [{ agent_id: params.agentId }]
      v2Filter.agent_id = [params.agentId]
    }
    if (params?.startTimestamp != null && params?.endTimestamp != null) {
      v3Filter.start_timestamp = {
        type: 'range',
        op: 'bt',
        value: [params.startTimestamp, params.endTimestamp],
      }
      v2Filter.start_timestamp = {
        lower_threshold: params.startTimestamp,
        upper_threshold: params.endTimestamp,
      }
    }
    if (params?.directionInboundOnly) {
      v3Filter.direction = {
        type: 'enum',
        op: 'in',
        value: ['inbound'],
      }
      v2Filter.direction = ['inbound']
    }

    const v3: Record<string, unknown> = { ...shared }
    const v2: Record<string, unknown> = { ...shared }
    if (Object.keys(v3Filter).length > 0) v3.filter_criteria = v3Filter
    if (Object.keys(v2Filter).length > 0) v2.filter_criteria = v2Filter

    return { v3, v2 }
  }

  private parseListCallsResponse(data: unknown): {
    calls: RetellCallListItem[]
    total?: number
    hasMore?: boolean
    paginationKey?: string
  } {
    if (Array.isArray(data)) {
      return { calls: data }
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from RetellAI list calls API')
    }

    const payload = data as Record<string, unknown>
    const calls = (payload.items ?? payload.calls) as RetellCallListItem[] | undefined
    if (!calls || !Array.isArray(calls)) {
      throw new Error('Invalid response format from RetellAI list calls API')
    }

    return {
      calls,
      total:
        typeof payload.total === 'number'
          ? payload.total
          : typeof payload.total === 'string' && payload.total.trim() !== ''
            ? Number(payload.total)
            : undefined,
      hasMore: typeof payload.has_more === 'boolean' ? payload.has_more : undefined,
      paginationKey:
        typeof payload.pagination_key === 'string' ? payload.pagination_key : undefined,
    }
  }

  private async postListCalls(
    url: string,
    body: Record<string, unknown>
  ): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
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
    /** Last call_id from previous page (exclusive); see Retell list-calls docs */
    paginationKey?: string
    /** When true, only inbound calls (typical inbound agent + Retell analytics) */
    directionInboundOnly?: boolean
    /** v3: return aggregate total matching filter_criteria */
    includeTotal?: boolean
  }): Promise<{
    calls: RetellCallListItem[]
    total?: number
    hasMore?: boolean
    paginationKey?: string
  }> {
    try {
      const { v3, v2 } = this.buildListCallsRequestBodies(params)

      let response = await this.postListCalls('https://api.retellai.com/v3/list-calls', v3)
      if (!response.ok) {
        response = await this.postListCalls(`${this.baseUrl}/list-calls`, v2)
      }

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
          } else if (errorJson.error_message) {
            errorMessage =
              typeof errorJson.error_message === 'string'
                ? errorJson.error_message
                : JSON.stringify(errorJson.error_message)
          }
        } catch {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      return this.parseListCallsResponse(data)
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
    const dynamicVariables = params.dynamicVariables || {}
    console.info('[RetellApi][Debug] create-phone-call request', {
      endpoint: `${this.baseUrl}/create-phone-call`,
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      overrideAgentId: params.overrideAgentId || null,
      metadataKeys: params.metadata ? Object.keys(params.metadata) : [],
      dynamicVariableKeys: Object.keys(dynamicVariables),
      dynamicVariablePreview: {
        patient_id: dynamicVariables.patient_id ?? null,
        patient_name: dynamicVariables.patient_name ?? null,
        patient_first_name: dynamicVariables.patient_first_name ?? null,
        patient_last_name: dynamicVariables.patient_last_name ?? null,
        patient_dob: dynamicVariables.patient_dob ?? null,
      },
    })
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
        // Some Retell agent paths read retell_llm_dynamic_variables while others
        // use dynamic_variables. Send both for maximum compatibility.
        retell_llm_dynamic_variables: dynamicVariables,
        dynamic_variables: dynamicVariables,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[RetellApi][Debug] create-phone-call error', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      })
      throw new Error(`Retell create-phone-call failed (${response.status}): ${errorText || response.statusText}`)
    }
    const json = await response.json()
    console.info('[RetellApi][Debug] create-phone-call response', {
      callId:
        (typeof json?.call_id === 'string' && json.call_id) ||
        (typeof json?.callId === 'string' && json.callId) ||
        null,
      responseKeys: json && typeof json === 'object' ? Object.keys(json as Record<string, unknown>) : [],
    })
    return json
  }
}

/**
 * Load Retell integration settings for a practice.
 */
export async function getRetellIntegrationConfig(practiceId: string): Promise<RetellIntegrationConfig> {
  const { prisma } = await import('./db')

  const integration = await prisma.retellIntegration.findUnique({
    where: { practiceId },
    select: {
      apiKey: true,
      agentId: true,
      insuranceVerificationAgentId: true,
      mcpBaseUrl: true,
      mcpApiKey: true,
      mcpActorId: true,
      mcpRequestIdPrefix: true,
      outboundToolName: true,
      isActive: true,
    },
  })

  if (!integration || !integration.isActive) {
    throw new Error('RetellAI integration not configured for this practice. Please configure it in Settings.')
  }

  return {
    practiceId,
    apiKey: integration.apiKey,
    agentId: integration.agentId ?? null,
    insuranceVerificationAgentId: integration.insuranceVerificationAgentId ?? null,
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

function generateUuid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16)
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
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
  const uuidRequestId = generateUuid()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': uuidRequestId,
    'X-Purpose': 'insurance_verification',
    'X-Actor-Type': 'agent',
    'X-Allow-Unmasked': 'true',
    'X-Client-Request-Id': requestId,
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
    const explicitDynamicVars =
      (args.retell_llm_dynamic_variables as Record<string, unknown> | undefined) ||
      (args.dynamic_variables as Record<string, unknown> | undefined) ||
      {}
    const dynamicVariables: Record<string, string> = {
      patient_context: JSON.stringify((args.context as Record<string, unknown> | undefined) || {}),
    }
    for (const [key, value] of Object.entries(explicitDynamicVars)) {
      if (value === null || value === undefined) continue
      dynamicVariables[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }
    const response = await client.createPhoneCall({
      fromNumber,
      toNumber,
      overrideAgentId: (args.agent_id as string | undefined)?.trim() || config.agentId || undefined,
      metadata: {
        ...((args.context as Record<string, unknown> | undefined) || {}),
        patient_id: dynamicVariables.patient_id || undefined,
        patient_name: dynamicVariables.patient_name || undefined,
        patient_dob: dynamicVariables.patient_dob || undefined,
      },
      dynamicVariables,
    })
    console.info('[RetellApi][Debug] outbound call created via direct API', {
      toolName,
      callId: typeof response.call_id === 'string' ? response.call_id : null,
      dynamicVariableKeys: Object.keys(dynamicVariables),
      dynamicVariablePreview: {
        patient_id: dynamicVariables.patient_id ?? null,
        patient_name: dynamicVariables.patient_name ?? null,
        patient_first_name: dynamicVariables.patient_first_name ?? null,
        patient_last_name: dynamicVariables.patient_last_name ?? null,
        patient_dob: dynamicVariables.patient_dob ?? null,
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
      allowUnmasked: true,
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
  if (toolName === 'create_outbound_call') {
    // Force direct Retell API call for outbound dialing so dynamic variables
    // are always attached to the phone call payload.
    return executeLocalFallbackTool({ config, toolName, args })
  }
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

  try {
    // Best-effort initialize handshake for MCP servers that expect lifecycle calls.
    await postJsonRpc(url, { jsonrpc: '2.0', id: `${rpcId}-init`, method: 'initialize', params: {} }, headers).catch(() => null)

    const callStarted = Date.now()
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

    console.info(
      `[MCP] retell_http tools/call tool=${toolName} url=${url} latencyMs=${Date.now() - callStarted} hasError=${Boolean(callResponse.error)}`
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isAuthError = /401|UNAUTHORIZED|Invalid or missing API key/i.test(message)

    if (toolName === 'create_outbound_call' && isAuthError) {
      console.warn('[Retell MCP] MCP auth failed, using local outbound fallback')
      return executeLocalFallbackTool({ config, toolName, args })
    }

    throw error
  }
}

