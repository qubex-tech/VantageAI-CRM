import React from 'react'
import { ActivityIndicator, View, Text } from 'react-native'
import { Colors } from '@/constants/colors'

interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  return (
    <View
      style={[
        { alignItems: 'center', justifyContent: 'center', gap: 12 },
        fullScreen && { flex: 1 },
      ]}
    >
      <ActivityIndicator size="large" color={Colors.primary} />
      {message && (
        <Text style={{ fontSize: 14, color: Colors.textSecondary }}>{message}</Text>
      )}
    </View>
  )
}
