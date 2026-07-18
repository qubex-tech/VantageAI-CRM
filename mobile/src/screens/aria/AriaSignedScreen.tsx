import React from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAriaSession } from '@/hooks/useAria'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { AriaStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<AriaStackParamList, 'AriaSigned'>
type Route = RouteProp<AriaStackParamList, 'AriaSigned'>

export function AriaSignedScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { data, isLoading } = useAriaSession(route.params.sessionId)
  const session = data?.session

  if (isLoading || !session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  const ehrLabel =
    session.ehrWritebackStatus === 'success'
      ? 'Draft note created in EHR'
      : session.ehrWritebackStatus === 'failed'
        ? `EHR writeback failed: ${session.ehrWritebackError || 'unknown error'}`
        : session.ehrWritebackStatus === 'skipped'
          ? 'Saved in Vantage (EHR sync skipped)'
          : 'Saved in Vantage'

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Signed</Text>
      </View>
      <Text style={styles.title}>Note signed</Text>
      <Text style={styles.patient}>{session.patient?.name || 'Patient'}</Text>
      <Text style={styles.meta}>{ehrLabel}</Text>

      <Pressable style={styles.btn} onPress={() => navigation.popToTop()}>
        <Text style={styles.btnText}>Done</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  badgeText: { color: colors.success, fontWeight: fontWeight.semibold },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  patient: { fontSize: fontSize.lg, color: colors.textSecondary },
  meta: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  btn: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  btnText: { color: colors.white, fontWeight: fontWeight.semibold, fontSize: fontSize.base },
})
