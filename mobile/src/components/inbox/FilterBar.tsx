import React from 'react'
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import type { ConversationStatus, Channel } from '@/types'

type StatusFilter = 'all' | ConversationStatus
type ChannelFilter = 'all' | Channel

interface FilterBarProps {
  status: StatusFilter
  channel: ChannelFilter
  onStatusChange: (s: StatusFilter) => void
  onChannelChange: (c: ChannelFilter) => void
}

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'open',     label: 'Open' },
  { key: 'pending',  label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
]

const CHANNEL_TABS: { key: ChannelFilter; label: string }[] = [
  { key: 'all',    label: 'All channels' },
  { key: 'sms',    label: 'SMS' },
  { key: 'email',  label: 'Email' },
  { key: 'secure', label: 'Secure' },
  { key: 'voice',  label: 'Voice' },
]

export function FilterBar({ status, channel, onStatusChange, onChannelChange }: FilterBarProps) {
  return (
    <View style={styles.wrapper}>
      {/* Status row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {STATUS_TABS.map((t) => {
          const active = status === t.key
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => onStatusChange(t.key)}
              style={[styles.pill, active && styles.pillActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Channel row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {CHANNEL_TABS.map((t) => {
          const active = channel === t.key
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => onChannelChange(t.key)}
              style={[styles.pill, active && styles.pillChannelActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.bg,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  pillChannelActive: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accent,
  },
  pillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.white,
  },
})
