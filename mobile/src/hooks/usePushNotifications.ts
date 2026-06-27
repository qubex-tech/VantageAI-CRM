import { useEffect, useRef } from 'react'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { registerPushToken } from '@/services/notifications'
import { supportsRemotePushNotifications } from '@/lib/expo-environment'

export interface PushNotificationHandlers {
  onNotification?: (notification: any) => void
  onResponse?: (response: any) => void
}

export function usePushNotifications(handlers?: PushNotificationHandlers) {
  const tokenRef = useRef<string | null>(null)
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!supportsRemotePushNotifications()) {
      return
    }

    let notificationListener: any
    let responseListener: any

    async function setup() {
      const Notifications = await import('expo-notifications')

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
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

      if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
        try {
          const lastResponse = await Notifications.getLastNotificationResponseAsync()
          if (lastResponse) {
            const ageSecs = Date.now() / 1000 - lastResponse.notification.date
            if (ageSecs < 60) {
              setTimeout(() => {
                handlersRef.current?.onResponse?.(lastResponse)
                Notifications.dismissNotificationAsync(
                  lastResponse.notification.request.identifier
                ).catch(() => null)
              }, 600)
            }
          }
        } catch {
          // Unavailable in some environments
        }
      }

      const token = await registerForPushNotificationsAsync(Notifications)
      tokenRef.current = token ?? null
    }

    setup().catch((err) => {
      if (__DEV__) console.warn('[PushNotifications] setup error', err)
    })

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
  if (!Device.isDevice) return undefined

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return undefined

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId
  if (!projectId) return undefined

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
    if (__DEV__) console.warn('[PushNotifications] Failed to register token', err)
  }

  return token
}
