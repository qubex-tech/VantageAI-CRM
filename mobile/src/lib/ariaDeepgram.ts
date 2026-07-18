import { configure } from 'react-native-deepgram'
import { fetchAriaStreamToken } from '@/services/aria'

let activeSessionId: string | null = null
let configured = false

export function setAriaDeepgramSessionId(sessionId: string | null) {
  activeSessionId = sessionId
}

export function getAriaDeepgramSessionId(): string | null {
  return activeSessionId
}

/** Call once at app startup. Tokens are minted per-session via Vantage. */
export function configureAriaDeepgram(): void {
  if (configured) return
  configured = true
  configure({
    getToken: async () => {
      if (!activeSessionId) {
        throw new Error('No Aria session for Deepgram token')
      }
      const grant = await fetchAriaStreamToken(activeSessionId)
      return {
        token: grant.accessToken,
        expiresInSeconds: grant.expiresIn,
      }
    },
  })
}
