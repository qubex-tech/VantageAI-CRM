import React, { useEffect, useState } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native'

import { AuthNavigator } from './AuthNavigator'
import { InboxNavigator } from './InboxNavigator'
import { CallsNavigator } from './CallsNavigator'
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen'

import { useAuthStore } from '@/store/authStore'
import { useUnreadCount } from '@/hooks/useConversations'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useNavigation } from '@react-navigation/native'
import { colors, fontSize, fontWeight } from '@/constants/theme'
import type { RootStackParamList, RootTabParamList } from './types'

const RootStack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<RootTabParamList>()

function MainTabs() {
  const { data: unreadCount = 0 } = useUnreadCount()
  const navigation = useNavigation<any>()

  // Register push notifications and wire up navigation on tap
  usePushNotifications({
    onResponse: (response) => {
      const data = response.notification.request.content.data
      if (data?.conversationId) {
        navigation.navigate('Inbox', {
          screen: 'ConversationDetail',
          params: { conversationId: data.conversationId },
        })
      }
    },
  })

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof RootTabParamList, [string, string]> = {
            Inbox:         ['chatbubbles',    'chatbubbles-outline'],
            Calls:         ['call',           'call-outline'],
            Notifications: ['notifications',  'notifications-outline'],
          }
          const [active, inactive] = icons[route.name as keyof RootTabParamList] ?? ['ellipse', 'ellipse-outline']
          const name = focused ? active : inactive
          return <Ionicons name={name as any} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen
        name="Inbox"
        component={InboxNavigator}
        options={{
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, fontSize: 10 },
        }}
      />
      <Tab.Screen name="Calls" component={CallsNavigator} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
    </Tab.Navigator>
  )
}

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  )
}

export function AppNavigator() {
  const { token, restoreSession } = useAuthStore()
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    restoreSession().finally(() => setInitializing(false))
  }, [restoreSession])

  if (initializing) return <LoadingScreen />

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <RootStack.Screen name="Main" component={MainTabs} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
})
