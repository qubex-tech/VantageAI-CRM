import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { colors, fontSize, fontWeight, spacing } from '@/constants/theme'

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus()
  const insets = useSafeAreaInsets()

  if (isConnected !== false) return null

  return (
    <View style={[styles.banner, { paddingTop: insets.top > 0 ? insets.top : spacing.sm }]}>
      <Ionicons name="cloud-offline-outline" size={14} color={colors.white} />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  text: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
})
