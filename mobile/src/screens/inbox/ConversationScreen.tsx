import React, { useRef, useCallback, useState } from 'react'
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { MessageBubble } from '@/components/inbox/MessageBubble'
import { ChannelBadge, StatusDot } from '@/components/common/Badge'
import { Avatar } from '@/components/common/Avatar'
import { EmptyState } from '@/components/common/EmptyState'
import { useConversation, useMessages, useSendMessage } from '@/hooks/useConversations'
import { useAuthStore } from '@/store/authStore'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { Message } from '@/types'
import type { InboxStackParamList } from '@/navigation/types'

type RouteT = RouteProp<InboxStackParamList, 'ConversationDetail'>

export function ConversationScreen() {
  const route = useRoute<RouteT>()
  const navigation = useNavigation()
  const { conversationId } = route.params

  const [replyText, setReplyText] = useState('')
  const listRef = useRef<FlatList<Message>>(null)

  const user = useAuthStore((s) => s.user)
  const { data: conversation } = useConversation(conversationId)
  const { data: messages = [], isLoading } = useMessages(conversationId)
  const sendMessage = useSendMessage()

  const patientName = conversation?.patient
    ? [conversation.patient.firstName, conversation.patient.lastName].filter(Boolean).join(' ') ||
      conversation.patient.name ||
      'Patient'
    : 'Patient'

  const handleSend = useCallback(async () => {
    const body = replyText.trim()
    if (!body || !conversation) return

    setReplyText('')
    await sendMessage.mutateAsync({
      conversationId,
      patientId: conversation.patient?.id ?? '',
      channel: conversation.channel,
      body,
    })

    // Scroll to bottom after send
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200)
  }, [replyText, conversation, conversationId, sendMessage])

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble message={item} currentUserId={user?.id ?? ''} />
    ),
    [user?.id]
  )

  const keyExtractor = useCallback((item: Message) => item.id, [])

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Custom header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {conversation ? (
            <>
              <Avatar name={patientName} size={34} />
              <View style={styles.headerMeta}>
                <Text style={styles.headerName} numberOfLines={1}>{patientName}</Text>
                <View style={styles.headerSub}>
                  <StatusDot status={conversation.status} />
                  <ChannelBadge channel={conversation.channel} />
                </View>
              </View>
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.accent} />
          )}
        </View>

        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages list */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.messageList,
              messages.length === 0 && styles.emptyContent,
            ]}
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="No messages yet"
                subtitle="Send the first message to start the conversation."
              />
            }
            onContentSizeChange={() =>
              messages.length > 0 && listRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* Reply composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Type a message…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1600}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!replyText.trim() || sendMessage.isPending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!replyText.trim() || sendMessage.isPending}
            activeOpacity={0.8}
          >
            {sendMessage.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    minHeight: 56,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerMeta: {
    flex: 1,
    gap: 2,
  },
  headerName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  headerSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerRight: {
    width: 36,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  emptyContent: {
    flexGrow: 1,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
})
