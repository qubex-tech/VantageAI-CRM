import { useEffect, useRef } from 'react'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { registerPushToken, unregisterPushToken } from '@/services/notifications'

export interface PushNotificationHandlers {
  onNotification?: (notification: any) => void
  onResponse?: (response: any) => void
}

export function usePushNotifications(handlers?: PushNotificationHandlers) {
  const tokenRef = useRef<string | null>(null)
  // Keep a stable ref to the latest handlers so listeners always call the
  // most-recent version even though the effect runs only once.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    let notificationListener: any
    let responseListener: any

    async function setup() {
      // Lazily import expo-notifications so it doesn't touch native
      // modules during module initialisation (crashes Expo Go).
      const Notifications = await import('expo-notifications')

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      })

      notificationListener = Notifications.addNotificationReceivedListener(
        (n: any) => handlersRef.current?.onNotification?.(n)
      )
      responseListener = Notifications.addNotificationResponseReceivedListener(
        (r: any) => handlersRef.current?.onResponse?.(r)
      )

      // ── Cold-start / killed-app case ──────────────────────────────────────
      // If the user tapped a notification that launched the app from a killed
      // state the response arrives *before* the listener above is registered.
      // Expo stores the last response so we can pick it up here.
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync()
        if (lastResponse) {
          // Only handle recent taps (within last 60 s) to avoid re-navigating
          // on a normal app launch long after the notification was tapped.
          const ageSecs = Date.now() / 1000 - lastResponse.notification.date
          if (ageSecs < 60) {
            // Deliver async so the navigator tree is ready before we navigate.
            setTimeout(() => {
              handlersRef.current?.onResponse?.(lastResponse)
              // Dismiss so the same notification doesn't re-navigate next launch.
              Notifications.dismissNotificationAsync(
                lastResponse.notification.request.identifier
              ).catch(() => null)
            }, 600)
          }
        }
      } catch (err) {
        console.warn('[PushNotifications] getLastNotificationResponseAsync error', err)
      }

      const token = await registerForPushNotificationsAsync(Notifications)
      tokenRef.current = token ?? null
    }

    setup().catch((err) =>
      console.warn('[PushNotifications] setup error', err)
    )

    return () => {
      notificationListener?.remove()
      responseListener?.remove()
    }
  }, [])

  return { tokenRef }
}

async function registerForPushNotificationsAsync(
  Notifications: typeof import('expo-notifications')
): Promise<string | undefined> {
  if (!Device.isDevice) {
    console.log('[PushNotifications] Physical device required')
    return undefined
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[PushNotifications] Permission denied')
    return undefined
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId
  if (!projectId) {
    console.warn('[PushNotifications] No EAS project ID configured — skipping token registration')
    return undefined
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = tokenData.data

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'VantageAI',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    })
  }

  try {
    await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android', Constants.expoConfig?.version)
  } catch (err) {
    console.warn('[PushNotifications] Failed to register token', err)
  }

  return token
}

export async function deregisterPushNotifications(): Promise<void> {
  try {
    const Notifications = await import('expo-notifications')
    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null)
    if (tokenData?.data) {
      await unregisterPushToken(tokenData.data).catch(() => null)
    }
  } catch {
    // no-op
  }
}
