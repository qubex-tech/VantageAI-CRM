import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { registerPushToken, unregisterPushToken } from '@/services/notifications'
import Constants from 'expo-constants'

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export interface PushNotificationHandlers {
  onNotification?: (notification: Notifications.Notification) => void
  onResponse?: (response: Notifications.NotificationResponse) => void
}

export function usePushNotifications(handlers?: PushNotificationHandlers) {
  const tokenRef = useRef<string | null>(null)
  const notificationListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      tokenRef.current = token ?? null
    })

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        handlers?.onNotification?.(notification)
      }
    )

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handlers?.onResponse?.(response)
      }
    )

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  return { tokenRef }
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  if (!Device.isDevice) {
    console.log('[PushNotifications] Must use a physical device for push notifications')
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

  // Get the Expo push token (wraps FCM/APNs)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) {
    console.warn('[PushNotifications] No EAS project ID configured')
    return undefined
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = tokenData.data

  const platform = Platform.OS === 'ios' ? 'ios' : 'android'

  try {
    await registerPushToken(token, platform, Constants.expoConfig?.version)
  } catch (err) {
    console.warn('[PushNotifications] Failed to register token with server', err)
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'VantageAI',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    })
  }

  return token
}

export async function deregisterPushNotifications(): Promise<void> {
  const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null)
  if (tokenData?.data) {
    await unregisterPushToken(tokenData.data).catch(() => null)
  }
}
