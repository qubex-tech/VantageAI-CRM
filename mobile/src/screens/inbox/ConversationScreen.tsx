import React, { useRef, useCallback, useState } from 'react'
import {
  View, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Text,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'

import { MessageBubble } from '@/components/inbox/MessageBubble'
import { Avatar } from '@/components/common/Avatar'
import { ChannelBadge, StatusPill } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { useConversation, useMessages, useSendMessage } from '@/hooks/useConversations'
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/theme'
import type { InboxStackParamList } from '@/navigation/types'

type RouteT = RouteProp<InboxStackParamList, 'ConversationDetail'>

export function ConversationScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteT>()
  const { conversationId } = route.params
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  const listRef = useRef<FlatList>(null)
  const [draft, setDraft] = useState('')

  const { data: conversation, isLoading: convLoading } = useConversation(conversationId)
  const { data, isLoading: msgsLoading }               = useMessages(conversationId)
  const sendMutation = useSendMessage()

  const messages = data?.messages ?? []
  const patient  = conversation?.patient
  const name = patient
    ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || 'Unknown'
    : 'Unknown Patient'

  const handleSend = useCallback(async () => {
    const body = draft.trim()
    if (!body || !conversation) return
    setDraft('')
    await sendMutation.mutateAsync({
      conversationId,
      patientId: conversation.patient?.id ?? '',
      channel: conversation.channel,
      body,
    })
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [draft, conversation, conversationId, sendMutation])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {patient && <Avatar name={name} size={36} />}

        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
          {conversation && (
            <View style={styles.headerMeta}>
              <ChannelBadge channel={conversation.channel} />
              <StatusPill status={conversation.status} />
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerBorder} />

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {msgsLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.accent} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={[styles.msgList, messages.length === 0 && styles.msgListEmpty]}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState icon="chatbubble-outline" title="No messages yet" subtitle="Start the conversation below." />
            }
          />
        )}

        {/* Composer */}
        <View style={[styles.composer, isTablet && styles.composerTablet, shadow.sm]}>
          {/* Channel pill */}
          {conversation?.channel && (
            <View style={styles.channelPill}>
              <Ionicons
                name={conversation.channel === 'email' ? 'mail-outline' : 'phone-portrait-outline'}
                size={12}
                color={colors.accent}
              />
              <Text style={styles.channelPillText}>
                {conversation.channel === 'email' ? 'Email' : 'SMS'}
              </Text>
            </View>
          )}
          <TextInput
            style={styles.composerInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={conversation?.channel === 'email' ? 'Type an email…' : 'Type a message…'}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={conversation?.channel === 'email' ? 10000 : 1600}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sendMutation.isPending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sendMutation.isPending}
            activeOpacity={0.8}
          >
            {sendMutation.isPending
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Ionicons name="arrow-up" size={18} color={colors.white} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  headerTablet: { paddingHorizontal: spacing.xxl },
  headerBorder: { height: 1, backgroundColor: colors.border },

  backBtn: { padding: spacing.xs },
  headerInfo: { flex: 1, gap: 2 },
  headerName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: {
    width: 34, height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  loader: { flex: 1 },
  msgList: { paddingVertical: spacing.lg },
  msgListEmpty: { flex: 1 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  composerTablet: { paddingHorizontal: spacing.xxl },
  composerInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    maxHeight: 120,
    lineHeight: 22,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },

  channelPill: {
    position: 'absolute',
    top: -22,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentLight,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.accentSurface,
  },
  channelPillText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
})
