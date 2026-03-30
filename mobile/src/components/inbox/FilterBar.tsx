import React from 'react'
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import type { ConversationStatus, Channel } from '@/types'

interface StatusTabsProps {
  selected: ConversationStatus | undefined
  onChange: (status: ConversationStatus | undefined) => void
}

const STATUS_OPTIONS: Array<{ label: string; value: ConversationStatus | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Open', value: 'open' },
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
]

export function StatusTabs({ selected, onChange }: StatusTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabRow}
    >
      {STATUS_OPTIONS.map((opt) => {
        const active = selected === opt.value
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

interface ChannelFilterProps {
  selected: Channel | undefined
  onChange: (channel: Channel | undefined) => void
}

const CHANNEL_OPTIONS: Array<{ label: string; value: Channel | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'SMS', value: 'sms' },
  { label: 'Email', value: 'email' },
  { label: 'Secure', value: 'secure' },
  { label: 'Voice', value: 'voice' },
]

export function ChannelFilter({ selected, onChange }: ChannelFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabRow}
    >
      {CHANNEL_OPTIONS.map((opt) => {
        const active = selected === opt.value
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  tabRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.divider,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  chipLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.accent,
    fontWeight: fontWeight.semibold,
  },
})
