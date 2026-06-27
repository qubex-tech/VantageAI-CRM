import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import { getConfigError } from '@/lib/config'

export function ConfigErrorScreen() {
  const message = getConfigError() ?? 'Application configuration is invalid.'

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="settings-outline" size={32} color={colors.error} />
        </View>
        <Text style={styles.title}>Configuration required</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.box}>
          <Text style={styles.boxTitle}>For EAS builds</Text>
          <Text style={styles.boxText}>
            Run:{'\n'}
            eas env:create --name EXPO_PUBLIC_API_URL --value https://your-app.vercel.app --environment production
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  box: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  boxTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  boxText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 18,
    fontFamily: 'Menlo',
  },
})
