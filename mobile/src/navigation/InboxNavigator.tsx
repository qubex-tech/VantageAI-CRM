import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { InboxScreen } from '@/screens/inbox/InboxScreen'
import { ConversationScreen } from '@/screens/inbox/ConversationScreen'
import type { InboxStackParamList } from './types'
import { colors } from '@/constants/theme'

const Stack = createNativeStackNavigator<InboxStackParamList>()

export function InboxNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="InboxList" component={InboxScreen} />
      <Stack.Screen name="ConversationDetail" component={ConversationScreen} />
    </Stack.Navigator>
  )
}
