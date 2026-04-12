import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, fontSize, radius, fontWeight } from '@/constants/theme'
import type { Channel, ConversationStatus } from '@/types'

const CHANNEL_CONFIG: Record<Channel, { label: string; bg: string; color: string }> = {
  sms:    { label: 'SMS',    bg: colors.smsLight,    color: colors.sms },
  email:  { label: 'Email',  bg: colors.emailLight,  color: colors.email },
  secure: { label: 'Secure', bg: colors.secureLight, color: colors.secure },
  voice:  { label: 'Voice',  bg: colors.voiceLight,  color: colors.voice },
  video:  { label: 'Video',  bg: colors.videoLight,  color: colors.video },
}

const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string }> = {
  open:     { label: 'Open',     color: colors.statusOpen },
  pending:  { label: 'Pending',  color: colors.statusPending },
  resolved: { label: 'Resolved', color: colors.statusResolved },
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  const cfg = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.sms
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <View style={styles.unread}>
      <Text style={styles.unreadText}>{count > 99 ? '99+' : count}</Text>
    </View>
  )
}

export function StatusDot({ status }: { status: ConversationStatus }) {
  return <View style={[styles.dot, { backgroundColor: STATUS_CONFIG[status]?.color ?? colors.textMuted }]} />
}

export function StatusPill({ status }: { status: ConversationStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status ?? 'Unknown', color: colors.textMuted }
  return (
    <View style={[styles.statusPill, { backgroundColor: cfg.color + '18' }]}>
      <View style={[styles.dot, { backgroundColor: cfg.color, marginRight: 4 }]} />
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
  unread: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: colors.white,
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.bold,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.semibold,
  },
})
