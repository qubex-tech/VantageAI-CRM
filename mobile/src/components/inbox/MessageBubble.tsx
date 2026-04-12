import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { format } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import type { Message } from '@/types'

interface Props {
  message: Message
}

const CHANNEL_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  sms:    { icon: 'phone-portrait-outline', label: 'SMS',    color: colors.sms   ?? '#16a34a' },
  email:  { icon: 'mail-outline',           label: 'Email',  color: colors.email ?? '#2563eb' },
  secure: { icon: 'lock-closed-outline',    label: 'Secure', color: '#7c3aed' },
  voice:  { icon: 'call-outline',           label: 'Voice',  color: '#ea580c' },
  video:  { icon: 'videocam-outline',       label: 'Video',  color: '#0891b2' },
}

export function MessageBubble({ message }: Props) {
  const { body, direction, type, channel, createdAt, deliveryStatus } = message
  const isOutbound = direction === 'outbound'
  const isInternal = type === 'note'
  const isSystem   = type === 'system'
  const time = format(new Date(createdAt), 'h:mm a')
  const ch = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.sms

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{body}</Text>
      </View>
    )
  }

  if (isInternal) {
    return (
      <View style={styles.noteWrap}>
        <View style={styles.noteBar} />
        <View style={styles.noteContent}>
          <Text style={styles.noteLabel}>Internal note</Text>
          <Text style={styles.noteBody}>{body}</Text>
          <Text style={styles.noteTime}>{time}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.row, isOutbound ? styles.rowOut : styles.rowIn]}>
      <View style={styles.bubbleGroup}>
        {/* Bubble */}
        <View style={[styles.bubble, isOutbound ? styles.bubbleOut : styles.bubbleIn]}>
          <Text style={[styles.body, isOutbound ? styles.bodyOut : styles.bodyIn]}>{body}</Text>
          <View style={styles.meta}>
            <Text style={[styles.time, isOutbound ? styles.timeOut : styles.timeIn]}>{time}</Text>
            {isOutbound && (
              <Ionicons
                name={deliveryStatus === 'delivered' || deliveryStatus === 'read' ? 'checkmark-done' : 'checkmark'}
                size={12}
                color="rgba(255,255,255,0.7)"
              />
            )}
          </View>
        </View>

        {/* Channel label below bubble */}
        <View style={[styles.channelTag, isOutbound ? styles.channelTagOut : styles.channelTagIn]}>
          <Ionicons name={ch.icon as any} size={10} color={ch.color} />
          <Text style={[styles.channelTagText, { color: ch.color }]}>{ch.label}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  rowOut: { alignItems: 'flex-end' },
  rowIn:  { alignItems: 'flex-start' },

  bubbleGroup: { gap: 4, maxWidth: '78%' },

  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
    gap: 4,
  },
  bubbleOut: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: radius.xs,
  },
  bubbleIn: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.xs,
  },

  body: { fontSize: fontSize.base, lineHeight: 22 },
  bodyOut: { color: colors.white },
  bodyIn:  { color: colors.text },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  time: { fontSize: fontSize.xxs },
  timeOut: { color: 'rgba(255,255,255,0.65)' },
  timeIn:  { color: colors.textMuted },

  channelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  channelTagOut: { alignSelf: 'flex-end' },
  channelTagIn:  { alignSelf: 'flex-start' },
  channelTagText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },

  // Internal note
  noteWrap: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noteBar:     { width: 3, backgroundColor: colors.warning },
  noteContent: { flex: 1, padding: spacing.md, gap: 3 },
  noteLabel:   { fontSize: fontSize.xxs, fontWeight: fontWeight.semibold, color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.5 },
  noteBody:    { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  noteTime:    { fontSize: fontSize.xxs, color: colors.textMuted },

  // System
  systemWrap:  { alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xxxl },
  systemText:  { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
})
