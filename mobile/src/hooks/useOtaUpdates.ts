import { useEffect } from 'react'
import * as Updates from 'expo-updates'

/** Check for OTA updates on launch (production builds only). */
export function useOtaUpdates() {
  useEffect(() => {
    if (__DEV__) return

    async function checkForUpdates() {
      try {
        if (!Updates.isEnabled) return

        const result = await Updates.checkForUpdateAsync()
        if (!result.isAvailable) return

        await Updates.fetchUpdateAsync()
        await Updates.reloadAsync()
      } catch {
        // OTA unavailable (e.g. first install) — ignore
      }
    }

    checkForUpdates()
  }, [])
}
