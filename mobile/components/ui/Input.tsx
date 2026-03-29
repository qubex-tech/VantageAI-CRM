import React from 'react'
import { TextInput, View, Text, TextInputProps } from 'react-native'
import { Colors } from '@/constants/colors'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
}

export function Input({ label, error, leftIcon, style, ...rest }: InputProps) {
  return (
    <View style={{ gap: 4 }}>
      {label && (
        <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.gray700 }}>{label}</Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? Colors.danger : Colors.border,
          borderRadius: 8,
          backgroundColor: Colors.white,
          paddingHorizontal: 12,
        }}
      >
        {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
        <TextInput
          style={[
            {
              flex: 1,
              fontSize: 15,
              color: Colors.text,
              paddingVertical: 11,
            },
            style,
          ]}
          placeholderTextColor={Colors.textMuted}
          {...rest}
        />
      </View>
      {error && (
        <Text style={{ fontSize: 12, color: Colors.danger }}>{error}</Text>
      )}
    </View>
  )
}
