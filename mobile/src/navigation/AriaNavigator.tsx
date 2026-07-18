import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AriaHomeScreen } from '@/screens/aria/AriaHomeScreen'
import { AriaCaptureScreen } from '@/screens/aria/AriaCaptureScreen'
import { AriaReviewScreen } from '@/screens/aria/AriaReviewScreen'
import { AriaSignedScreen } from '@/screens/aria/AriaSignedScreen'
import { AriaPatientPickerScreen } from '@/screens/aria/AriaPatientPickerScreen'
import type { AriaStackParamList } from '@/navigation/types'
import { colors } from '@/constants/theme'

const Stack = createNativeStackNavigator<AriaStackParamList>()

export function AriaNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.accent,
        headerTitleStyle: { fontWeight: '600', color: colors.text },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="AriaHome"
        component={AriaHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AriaPatientPicker"
        component={AriaPatientPickerScreen}
        options={{ title: 'Choose patient' }}
      />
      <Stack.Screen
        name="AriaCapture"
        component={AriaCaptureScreen}
        options={{ title: 'Aria', headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="AriaReview"
        component={AriaReviewScreen}
        options={{ title: 'Review note' }}
      />
      <Stack.Screen
        name="AriaSigned"
        component={AriaSignedScreen}
        options={{ title: 'Signed', headerBackVisible: false }}
      />
    </Stack.Navigator>
  )
}
