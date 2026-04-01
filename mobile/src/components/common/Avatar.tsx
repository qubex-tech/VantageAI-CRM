import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, fontWeight, fontSize } from '@/constants/theme'

interface AvatarProps {
  name: string
  size?: number
}

const PALETTE = [
  '#3B6FEA','#7C3AED','#059669','#D97706','#DC2626',
  '#0891B2','#BE185D','#65A30D','#EA580C','#6366F1',
]

function colorFromName(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 40 }: AvatarProps) {
  const bg = colorFromName(name)
  const textSize = size * 0.38
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.initials, { fontSize: textSize }]}>{initials(name)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: fontWeight.semibold, letterSpacing: 0.5 },
})
