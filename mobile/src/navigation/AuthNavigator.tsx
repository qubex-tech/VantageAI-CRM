import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { LoginScreen } from '@/screens/auth/LoginScreen'
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen'
import { VerifyOTPScreen } from '@/screens/auth/VerifyOTPScreen'
import { NewPasswordScreen } from '@/screens/auth/NewPasswordScreen'
import type { AuthStackParamList } from './types'

const Stack = createNativeStackNavigator<AuthStackParamList>()

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyOTP"      component={VerifyOTPScreen} />
      <Stack.Screen name="NewPassword"    component={NewPasswordScreen} />
    </Stack.Navigator>
  )
}
