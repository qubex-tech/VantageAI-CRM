import React, { useEffect, useState } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { View, ActivityIndicator, StyleSheet } from 'react-native'

import { AuthNavigator } from './AuthNavigator'
import { InboxNavigator } from './InboxNavigator'
import { CallsNavigator } from './CallsNavigator'
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen'
import { ProfileScreen } from '@/screens/profile/ProfileScreen'

import { useAuthStore } from '@/store/authStore'
import { useUnreadCount } from '@/hooks/useConversations'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useNavigation } from '@react-navigation/native'
import { colors } from '@/constants/theme'
import type { RootStackParamList, RootTabParamList } from './types'

const RootStack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<RootTabParamList>()

const TAB_ICONS: Record<keyof RootTabParamList, [string, string]> = {
  Inbox:         ['chatbubbles',   'chatbubbles-outline'],
  Calls:         ['call',          'call-outline'],
  Notifications: ['notifications', 'notifications-outline'],
  Profile:       ['person',        'person-outline'],
}

function MainTabs() {
  const { data: unreadCount = 0 } = useUnreadCount()
  const navigation = useNavigation<any>()

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
          const [active, inactive] = TAB_ICONS[route.name as keyof RootTabParamList] ?? ['ellipse', 'ellipse-outline']
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />
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
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
