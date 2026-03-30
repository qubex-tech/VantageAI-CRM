import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { formatDistanceToNowStrict } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import { Avatar } from '@/components/common/Avatar'
import { ChannelBadge, UnreadBadge } from '@/components/common/Badge'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { MobileNotification } from '@/types'

interface Props {
  notification: MobileNotification
  onPress: (notification: MobileNotification) => void
}

const CHANNEL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  sms: 'chatbubble-outline',
  email: 'mail-outline',
  secure: 'lock-closed-outline',
  voice: 'call-outline',
  video: 'videocam-outline',
}

export function NotificationItem({ notification, onPress }: Props) {
  const { patientName, channel, unreadCount, preview, latestMessageAt } = notification
  const hasUnread = unreadCount > 0

  const timeAgo = latestMessageAt
    ? formatDistanceToNowStrict(new Date(latestMessageAt), { addSuffix: true })
    : ''

  const channelIcon = CHANNEL_ICONS[channel] ?? 'chatbubble-outline'

  return (
    <TouchableOpacity
      style={[styles.container, hasUnread && styles.unread]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      {/* Unread indicator stripe */}
      {hasUnread && <View style={styles.stripe} />}

      <View style={styles.avatarWrap}>
        <Avatar name={patientName} size={44} />
        <View style={styles.channelIcon}>
          <Ionicons name={channelIcon} size={12} color={colors.white} />
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.name, hasUnread && styles.nameBold]} numberOfLines={1}>
            {patientName}
          </Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>

        <View style={styles.subRow}>
          <ChannelBadge channel={channel} />
          {hasUnread && <UnreadBadge count={unreadCount} size="sm" />}
        </View>

        {preview ? (
          <Text style={[styles.preview, hasUnread && styles.previewBold]} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  unread: {
    backgroundColor: '#EFF6FF',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  avatarWrap: {
    marginRight: spacing.md,
    position: 'relative',
  },
  channelIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  nameBold: {
    fontWeight: fontWeight.bold,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    flexShrink: 0,
  },
  preview: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  previewBold: {
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
})
