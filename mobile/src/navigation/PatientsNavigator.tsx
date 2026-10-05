import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { PatientsSearchScreen } from '@/screens/patients/PatientsSearchScreen'
import { PatientDetailScreen } from '@/screens/patients/PatientDetailScreen'
import { GlassesSessionScreen } from '@/screens/patients/GlassesSessionScreen'
import type { PatientsStackParamList } from './types'

const Stack = createNativeStackNavigator<PatientsStackParamList>()

export function PatientsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: '#111827',
        headerStyle: { backgroundColor: '#FFFFFF' },
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen
        name="PatientsSearch"
        component={PatientsSearchScreen}
        options={{ title: 'Patients' }}
      />
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetailScreen}
        options={{ title: 'Patient' }}
      />
      <Stack.Screen
        name="GlassesSession"
        component={GlassesSessionScreen}
        options={{ title: 'Glasses' }}
      />
    </Stack.Navigator>
  )
}
