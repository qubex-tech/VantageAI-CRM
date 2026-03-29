import React from 'react'
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from 'react-native'
import { Colors } from '@/constants/colors'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends TouchableOpacityProps {
  title: string
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const variantStyles: Record<Variant, { container: object; text: object }> = {
  primary: {
    container: { backgroundColor: Colors.primary },
    text: { color: Colors.white, fontWeight: '600' },
  },
  secondary: {
    container: { backgroundColor: Colors.gray100 },
    text: { color: Colors.gray700, fontWeight: '600' },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
    text: { color: Colors.gray700, fontWeight: '600' },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: Colors.primary, fontWeight: '600' },
  },
  danger: {
    container: { backgroundColor: Colors.danger },
    text: { color: Colors.white, fontWeight: '600' },
  },
}

const sizeStyles: Record<Size, { container: object; text: object }> = {
  sm: {
    container: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    text: { fontSize: 13 },
  },
  md: {
    container: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    text: { fontSize: 15 },
  },
  lg: {
    container: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 },
    text: { fontSize: 16 },
  },
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const v = variantStyles[variant]
  const s = sizeStyles[size]
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      style={[
        v.container,
        s.container,
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
        isDisabled && { opacity: 0.6 },
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.75}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? Colors.white : Colors.primary}
        />
      ) : (
        icon && <View>{icon}</View>
      )}
      <Text style={[v.text, s.text]}>{title}</Text>
    </TouchableOpacity>
  )
}
