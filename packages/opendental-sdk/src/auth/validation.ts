import { OpenDentalClient, createClientFromContext } from '../client/OpenDentalClient'
import { validateConnection } from '../practice/connectionHealth'
import type { PracticeContext } from '../practice/types'

export async function validateAuthentication(client: OpenDentalClient): Promise<boolean> {
  const result = await validateConnection(client)
  return result.valid
}

export { validateConnection }

export function createValidatedClient(context: PracticeContext, developerKey?: string): OpenDentalClient {
  return createClientFromContext(context, developerKey)
}
