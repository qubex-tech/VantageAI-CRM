import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { formatDistanceToNowStrict } from 'date-fns'
import { Avatar } from '@/components/common/Avatar'
import { ChannelBadge } from '@/components/common/Badge'
import { colors, spacing, fontSize, fontWeight } from '@/constants/theme'
import type { MobileNotification } from '@/types'

interface Props {
  notification: MobileNotification
  onPress: () => void
}

export function NotificationItem({ notification, onPress }: Props) {
  const { patientName, channel, preview, latestMessageAt, unreadCount } = notification
  const hasUnread = unreadCount > 0
  const time = latestMessageAt
    ? formatDistanceToNowStrict(new Date(latestMessageAt), { addSuffix: false })
    : ''

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={styles.row}>
      <View style={[styles.unreadBar, hasUnread && styles.unreadBarActive]} />
      <Avatar name={patientName} size={42} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>{patientName}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {preview ?? 'New message'}
          </Text>
          <ChannelBadge channel={channel} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    paddingLeft: spacing.lg,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  unreadBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    borderRadius: 99,
    backgroundColor: 'transparent',
  },
  unreadBarActive: { backgroundColor: colors.accent },
  content: { flex: 1, gap: 4 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.text },
  nameUnread: { fontWeight: fontWeight.semibold },
  time: { fontSize: fontSize.xs, color: colors.textMuted },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  preview: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
  previewUnread: { fontWeight: fontWeight.medium },
})
