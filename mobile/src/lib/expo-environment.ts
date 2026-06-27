import Constants, { ExecutionEnvironment } from 'expo-constants'

/** True when running inside the Expo Go app (not a standalone or dev build). */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient
}

/** Remote push tokens require a development or production build (SDK 53+). */
export function supportsRemotePushNotifications(): boolean {
  return !isExpoGo()
}
