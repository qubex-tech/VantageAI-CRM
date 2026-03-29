import React from 'react'
import { View, ViewProps } from 'react-native'
import { Colors } from '@/constants/colors'

interface CardProps extends ViewProps {
  children: React.ReactNode
  padding?: number
}

export function Card({ children, padding = 16, style, ...rest }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.surface,
          borderRadius: 12,
          padding,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}
