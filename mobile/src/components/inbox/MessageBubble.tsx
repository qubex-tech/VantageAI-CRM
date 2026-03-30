import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { format } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import type { Message } from '@/types'

interface Props {
  message: Message
  currentUserId: string
}

export function MessageBubble({ message, currentUserId }: Props) {
  const isOutbound = message.direction === 'outbound'
  const isInternal = message.type === 'note'
  const isSystem = message.type === 'system'
  const isMine = isOutbound && message.authorId === currentUserId

  const time = format(new Date(message.createdAt), 'h:mm a')

  if (isSystem) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.body}</Text>
        <Text style={styles.systemTime}>{time}</Text>
      </View>
    )
  }

  if (isInternal) {
    return (
      <View style={styles.noteRow}>
        <View style={styles.noteBubble}>
          <View style={styles.noteHeader}>
            <Ionicons name="lock-closed-outline" size={11} color={colors.warning} />
            <Text style={styles.noteLabel}> Internal Note</Text>
          </View>
          <Text style={styles.noteText}>{message.body}</Text>
          <Text style={styles.noteTime}>{time}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.row, isOutbound ? styles.rowOutbound : styles.rowInbound]}>
      <View
        style={[
          styles.bubble,
          isOutbound ? styles.bubbleOutbound : styles.bubbleInbound,
        ]}
      >
        <Text style={[styles.body, isOutbound ? styles.bodyOutbound : styles.bodyInbound]}>
          {message.body}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.time, isOutbound ? styles.timeOutbound : styles.timeInbound]}>
            {time}
          </Text>
          {isOutbound && <DeliveryIcon status={message.deliveryStatus} />}
        </View>
      </View>
    </View>
  )
}

function DeliveryIcon({ status }: { status: string | null }) {
  if (!status) return null
  const map: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
    queued: { name: 'time-outline', color: colors.textMuted },
    sent: { name: 'checkmark-outline', color: colors.textMuted },
    delivered: { name: 'checkmark-done-outline', color: colors.accent },
    read: { name: 'checkmark-done', color: colors.success },
    failed: { name: 'close-circle-outline', color: colors.error },
  }
  const icon = map[status]
  if (!icon) return null
  return <Ionicons name={icon.name} size={12} color={icon.color} style={{ marginLeft: 3 }} />
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
  },
  rowInbound: {
    justifyContent: 'flex-start',
  },
  rowOutbound: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  bubbleInbound: {
    backgroundColor: colors.divider,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleOutbound: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: 21,
  },
  bodyInbound: {
    color: colors.textPrimary,
  },
  bodyOutbound: {
    color: colors.white,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  time: {
    fontSize: fontSize.xs,
  },
  timeInbound: {
    color: colors.textMuted,
  },
  timeOutbound: {
    color: 'rgba(255,255,255,0.6)',
  },

  // System message
  systemRow: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    gap: 2,
    marginBottom: spacing.xs,
  },
  systemText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  systemTime: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Note bubble
  noteRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  noteBubble: {
    maxWidth: '85%',
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.md,
    gap: 4,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteLabel: {
    fontSize: fontSize.xs,
    color: colors.warning,
    fontWeight: fontWeight.semibold,
  },
  noteText: {
    fontSize: fontSize.sm,
    color: '#92400E',
    lineHeight: 18,
  },
  noteTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },
})
