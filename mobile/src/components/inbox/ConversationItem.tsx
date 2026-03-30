import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { formatDistanceToNowStrict } from 'date-fns'
import { Avatar } from '@/components/common/Avatar'
import { UnreadBadge, ChannelBadge, StatusDot } from '@/components/common/Badge'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { Conversation } from '@/types'

interface Props {
  conversation: Conversation
  onPress: (conversation: Conversation) => void
}

export function ConversationItem({ conversation, onPress }: Props) {
  const { patient, latestMessage, unreadCount, channel, status } = conversation
  const hasUnread = unreadCount > 0

  const patientName = patient
    ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.name || 'Unknown'
    : 'Unknown Patient'

  const timeAgo = conversation.lastMessageAt
    ? formatDistanceToNowStrict(new Date(conversation.lastMessageAt), { addSuffix: true })
    : ''

  const preview = latestMessage?.body
    ? latestMessage.body.length > 100
      ? latestMessage.body.slice(0, 97) + '…'
      : latestMessage.body
    : 'No messages yet'

  return (
    <TouchableOpacity
      style={[styles.container, hasUnread && styles.unreadContainer]}
      onPress={() => onPress(conversation)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarCol}>
        <Avatar name={patientName} size={44} />
        <View style={styles.statusDotWrap}>
          <StatusDot status={status} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {patientName}
          </Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>

        <View style={styles.row}>
          <ChannelBadge channel={channel} />
          {hasUnread && <UnreadBadge count={unreadCount} size="sm" />}
        </View>

        <Text
          style={[styles.preview, hasUnread && styles.previewUnread]}
          numberOfLines={2}
        >
          {latestMessage?.direction === 'outbound' ? 'You: ' : ''}
          {preview}
        </Text>
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
  unreadContainer: {
    backgroundColor: '#EFF6FF',
  },
  avatarCol: {
    marginRight: spacing.md,
    position: 'relative',
  },
  statusDotWrap: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 1,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  nameUnread: {
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
  previewUnread: {
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
})
