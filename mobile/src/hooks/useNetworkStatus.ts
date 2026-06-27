import { useEffect, useState } from 'react'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true)

  useEffect(() => {
    let mounted = true

    const apply = (state: NetInfoState) => {
      if (!mounted) return
      setIsConnected(state.isConnected ?? state.isInternetReachable ?? true)
    }

    NetInfo.fetch().then(apply)
    const unsubscribe = NetInfo.addEventListener(apply)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  return { isConnected }
}
