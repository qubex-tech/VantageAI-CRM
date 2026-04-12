import React, { useRef, useCallback, useState, useEffect } from 'react'
import {
  View, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Text,
  useWindowDimensions, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native'

import { MessageBubble } from '@/components/inbox/MessageBubble'
import { Avatar } from '@/components/common/Avatar'
import { StatusPill } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { useConversation, useMessages, useSendMessage } from '@/hooks/useConversations'
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/theme'
import type { InboxStackParamList } from '@/navigation/types'
import type { Channel } from '@/types'

type RouteT = RouteProp<InboxStackParamList, 'ConversationDetail'>

const CHANNELS: { key: Channel; label: string; icon: string }[] = [
  { key: 'sms',   label: 'SMS',   icon: 'phone-portrait-outline' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
]

const CHANNEL_COLORS: Record<string, string> = {
  sms:   '#16a34a',
  email: '#2563eb',
}

export function ConversationScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteT>()
  const { conversationId } = route.params
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  const listRef = useRef<FlatList>(null)
  const [draft, setDraft]               = useState('')
  const [activeChannel, setActiveChannel] = useState<Channel>('sms')

  const { data: conversation, isLoading: convLoading } = useConversation(conversationId)
  const { data, isLoading: msgsLoading, refetch: refetchMessages, isRefetching } = useMessages(conversationId)
  const sendMutation = useSendMessage()

  // Refetch messages every time the screen comes into focus
  useFocusEffect(useCallback(() => {
    refetchMessages()
  }, [refetchMessages]))

  const messages = Array.isArray(data) ? data : (data as any)?.messages ?? []
  const patient  = (conversation as any)?.patient ?? null
  const name = patient
    ? (`${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || patient.name || 'Unknown')
    : 'Unknown Patient'

  // Initialise channel from conversation once loaded
  useEffect(() => {
    if (conversation?.channel && (conversation.channel === 'sms' || conversation.channel === 'email')) {
      setActiveChannel(conversation.channel as Channel)
    }
  }, [conversation?.channel])

  const hasPhone = Boolean(patient?.primaryPhone || patient?.phone)
  const hasEmail = Boolean(patient?.email)
  const channelDisabled = (ch: Channel) => (ch === 'sms' && !hasPhone) || (ch === 'email' && !hasEmail)

  const accentColor = CHANNEL_COLORS[activeChannel] ?? colors.accent

  const handleSend = useCallback(async () => {
    const body = draft.trim()
    if (!body || !conversation) return
    setDraft('')
    await sendMutation.mutateAsync({
      conversationId,
      patientId: (conversation as any).patient?.id ?? '',
      channel: activeChannel,
      body,
    })
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [draft, conversation, conversationId, sendMutation, activeChannel])

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
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetchMessages}
                tintColor={colors.accent}
              />
            }
            ListEmptyComponent={
              <EmptyState icon="chatbubble-outline" title="No messages yet" subtitle="Start the conversation below." />
            }
          />
        )}

        {/* Composer */}
        <View style={[styles.composerWrap, isTablet && styles.composerWrapTablet]}>

          {/* Channel toggle */}
          <View style={styles.channelToggle}>
            {CHANNELS.map((ch) => {
              const isActive   = activeChannel === ch.key
              const isDisabled = channelDisabled(ch.key)
              const btnColor   = CHANNEL_COLORS[ch.key]
              return (
                <TouchableOpacity
                  key={ch.key}
                  style={[
                    styles.channelBtn,
                    isActive && { backgroundColor: btnColor, borderColor: btnColor },
                    isDisabled && styles.channelBtnDisabled,
                  ]}
                  onPress={() => !isDisabled && setActiveChannel(ch.key)}
                  activeOpacity={0.75}
                  disabled={isDisabled}
                >
                  <Ionicons
                    name={ch.icon as any}
                    size={13}
                    color={isActive ? colors.white : isDisabled ? colors.textMuted : btnColor}
                  />
                  <Text style={[
                    styles.channelBtnText,
                    { color: isActive ? colors.white : isDisabled ? colors.textMuted : btnColor },
                  ]}>
                    {ch.label}
                  </Text>
                  {isDisabled && (
                    <Text style={styles.channelBtnNoContact}>no contact</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Input row */}
          <View style={[styles.composer, shadow.sm]}>
            <TextInput
              style={[styles.composerInput, { borderColor: accentColor + '55' }]}
              value={draft}
              onChangeText={setDraft}
              placeholder={activeChannel === 'email' ? 'Type an email…' : 'Type a message…'}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={activeChannel === 'email' ? 10000 : 1600}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: accentColor }, (!draft.trim() || sendMutation.isPending) && styles.sendBtnDisabled]}
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

  composerWrap: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  composerWrapTablet: { paddingHorizontal: spacing.xxl },

  // Channel toggle
  channelToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  channelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  channelBtnDisabled: {
    opacity: 0.45,
  },
  channelBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  channelBtnNoContact: {
    fontSize: 9,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Input row
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1.5,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
})
