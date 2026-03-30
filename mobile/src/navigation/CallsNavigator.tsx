import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { CallsScreen } from '@/screens/calls/CallsScreen'
import { CallDetailScreen } from '@/screens/calls/CallDetailScreen'
import type { CallsStackParamList } from './types'

const Stack = createNativeStackNavigator<CallsStackParamList>()

export function CallsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CallsList"   component={CallsScreen} />
      <Stack.Screen name="CallDetail"  component={CallDetailScreen} />
    </Stack.Navigator>
  )
}
