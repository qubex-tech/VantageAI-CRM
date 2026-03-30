import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, fontSize, radius, spacing } from '@/constants/theme'

interface BadgeProps {
  count: number
  max?: number
  size?: 'sm' | 'md'
}

export function UnreadBadge({ count, max = 99, size = 'md' }: BadgeProps) {
  if (count <= 0) return null
  const label = count > max ? `${max}+` : String(count)
  const isSmall = size === 'sm'

  return (
    <View style={[styles.badge, isSmall && styles.badgeSm]}>
      <Text style={[styles.text, isSmall && styles.textSm]}>{label}</Text>
    </View>
  )
}

interface ChannelBadgeProps {
  channel: string
}

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  secure: 'Secure',
  voice: 'Voice',
  video: 'Video',
}

const CHANNEL_COLORS: Record<string, string> = {
  sms: colors.sms,
  email: colors.email,
  secure: colors.secure,
  voice: colors.voice,
  video: colors.video,
}

export function ChannelBadge({ channel }: ChannelBadgeProps) {
  const bg = CHANNEL_COLORS[channel] ?? colors.textMuted
  const label = CHANNEL_LABELS[channel] ?? channel

  return (
    <View style={[styles.channelBadge, { backgroundColor: bg + '20' }]}>
      <Text style={[styles.channelText, { color: bg }]}>{label}</Text>
    </View>
  )
}

interface StatusDotProps {
  status: 'open' | 'pending' | 'resolved'
}

const STATUS_COLORS: Record<string, string> = {
  open: colors.success,
  pending: colors.warning,
  resolved: colors.textMuted,
}

export function StatusDot({ status }: StatusDotProps) {
  return <View style={[styles.dot, { backgroundColor: STATUS_COLORS[status] ?? colors.textMuted }]} />
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
  },
  text: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '700',
    lineHeight: 14,
  },
  textSm: {
    fontSize: 10,
    lineHeight: 12,
  },
  channelBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  channelText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
})
