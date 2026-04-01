import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { formatDistanceToNowStrict } from 'date-fns'
import { Avatar } from '@/components/common/Avatar'
import { ChannelBadge } from '@/components/common/Badge'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { Conversation } from '@/types'

interface Props {
  conversation: Conversation
  onPress: () => void
}

export function ConversationItem({ conversation, onPress }: Props) {
  const { patient, latestMessage, unreadCount, channel, lastMessageAt, status } = conversation
  const name = patient
    ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || patient.name || 'Unknown'
    : 'Unknown Patient'
  const preview = latestMessage?.body ?? 'No messages yet'
  const time = lastMessageAt
    ? formatDistanceToNowStrict(new Date(lastMessageAt), { addSuffix: false })
    : ''
  const hasUnread = unreadCount > 0

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={styles.row}>
      {/* Unread indicator */}
      <View style={[styles.unreadBar, hasUnread && styles.unreadBarActive]} />

      <Avatar name={name} size={42} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>{name}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          <View style={styles.badges}>
            {hasUnread && (
              <View style={styles.dot} />
            )}
            <ChannelBadge channel={channel} />
          </View>
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
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  unreadBarActive: {
    backgroundColor: colors.accent,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  nameUnread: {
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  preview: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  previewUnread: {
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
})
