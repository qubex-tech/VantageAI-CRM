import React from 'react'
import { View, Text } from 'react-native'

interface BadgeProps {
  label: string
  bg: string
  color: string
  size?: 'sm' | 'md'
}

export function Badge({ label, bg, color, size = 'md' }: BadgeProps) {
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: size === 'sm' ? 6 : 8,
        paddingVertical: size === 'sm' ? 2 : 3,
        borderRadius: 99,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color,
          fontSize: size === 'sm' ? 11 : 12,
          fontWeight: '600',
          textTransform: 'capitalize',
        }}
      >
        {label.replace(/_/g, ' ')}
      </Text>
    </View>
  )
}
