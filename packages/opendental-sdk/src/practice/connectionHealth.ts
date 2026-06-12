import { OpenDentalClient } from '../client/OpenDentalClient'
import type { PracticeContext } from './types'

export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export type ConnectionHealthResult = {
  status: ConnectionHealthStatus
  checkedAt: Date
  baseUrlUsed: string
  latencyMs: number
  odVersion?: string
  error?: string
}

export async function checkConnectionHealth(
  client: OpenDentalClient,
  context: PracticeContext
): Promise<ConnectionHealthResult> {
  const started = Date.now()
  try {
    const preferences = await client.get<Record<string, string>[]>('preferences', {
      params: { PrefName: 'ProgramVersion' },
    })
    const odVersion = preferences?.[0]?.ValueString ?? preferences?.[0]?.['ValueString']
    return {
      status: 'healthy',
      checkedAt: new Date(),
      baseUrlUsed: client.getActiveBaseUrl(),
      latencyMs: Date.now() - started,
      odVersion: typeof odVersion === 'string' ? odVersion : undefined,
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      checkedAt: new Date(),
      baseUrlUsed: client.getActiveBaseUrl(),
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Connection check failed',
    }
  }
}

export async function validateConnection(
  client: OpenDentalClient
): Promise<{ valid: boolean; message: string }> {
  try {
    await client.get<unknown[]>('clinics')
    return { valid: true, message: 'Connection validated successfully' }
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : 'Connection validation failed',
    }
  }
}
