import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { AppNavigator } from './src/navigation/AppNavigator'
import { ErrorBoundary } from './src/components/common/ErrorBoundary'
import { ConfigErrorScreen } from './src/components/common/ConfigErrorScreen'
import { OfflineBanner } from './src/components/common/OfflineBanner'
import { setUnauthorizedHandler } from './src/services/apiClient'
import { useAuthStore } from './src/store/authStore'
import { getConfigError } from './src/lib/config'
import { useOtaUpdates } from './src/hooks/useOtaUpdates'

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status
    if (status === 401 || status === 403 || status === 404) return false
  }
  return failureCount < 2
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      staleTime: 15_000,
    },
    mutations: {
      retry: false,
    },
  },
})

function SessionGuard() {
  useOtaUpdates()

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await useAuthStore.getState().forceLogout()
      queryClient.clear()
    })
  }, [])

  return (
    <ErrorBoundary onReset={() => queryClient.clear()}>
      <View style={styles.root}>
        <OfflineBanner />
        <NavigationContainer>
          <StatusBar style="auto" />
          <AppNavigator />
        </NavigationContainer>
      </View>
    </ErrorBoundary>
  )
}

export default function App() {
  const configError = getConfigError()
  if (configError) {
    return (
      <SafeAreaProvider>
        <ConfigErrorScreen />
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionGuard />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
