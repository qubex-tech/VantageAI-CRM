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
}

/**
 * Get RetellAI client for a practice
 * Retrieves API key from database (stored per-practice)
 */
export async function getRetellClient(practiceId: string): Promise<RetellApiClient> {
  const { prisma } = await import('./db')
  
  const integration = await prisma.retellIntegration.findUnique({
    where: { practiceId },
  })

  if (!integration || !integration.isActive) {
    throw new Error('RetellAI integration not configured for this practice. Please configure it in Settings.')
  }

  return new RetellApiClient(integration.apiKey)
}

