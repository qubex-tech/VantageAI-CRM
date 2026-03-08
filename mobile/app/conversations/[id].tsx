import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { useConversation, useMessages, useSendMessage } from '@/hooks/useConversations'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Badge } from '@/components/ui/Badge'
import { ChannelColors, Colors } from '@/constants/colors'
import type { Message } from '@/types'

const channelIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  sms: 'chatbubble-outline',
  email: 'mail-outline',
  secure: 'lock-closed-outline',
  voice: 'call-outline',
  video: 'videocam-outline',
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'
  return (
    <View
      style={{
        flexDirection: isOutbound ? 'row-reverse' : 'row',
        marginHorizontal: 12,
        marginVertical: 4,
        alignItems: 'flex-end',
        gap: 6,
      }}
    >
      <View
        style={{
          maxWidth: '78%',
          backgroundColor: isOutbound ? Colors.primary : Colors.white,
          borderRadius: 14,
          borderBottomRightRadius: isOutbound ? 4 : 14,
          borderBottomLeftRadius: isOutbound ? 14 : 4,
          padding: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            color: isOutbound ? Colors.white : Colors.text,
            lineHeight: 19,
          }}
        >
          {message.content}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: isOutbound ? 'rgba(255,255,255,0.7)' : Colors.textMuted,
            marginTop: 3,
            textAlign: 'right',
          }}
        >
          {message.sentAt || message.createdAt
            ? format(parseISO(message.sentAt ?? message.createdAt), 'h:mm a')
            : ''}
        </Text>
      </View>
    </View>
  )
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [messageText, setMessageText] = useState('')
  const listRef = useRef<FlatList>(null)

  const { data: conversation } = useConversation(id)
  const { data: messages, isLoading } = useMessages(id)
  const sendMessage = useSendMessage(id)

  async function handleSend() {
    if (!messageText.trim() || !conversation) return
    const content = messageText.trim()
    setMessageText('')
    try {
      await sendMessage.mutateAsync({ content, channel: conversation.channel })
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      setMessageText(content)
      Alert.alert('Error', 'Message failed to send. Please try again.')
    }
  }

  const channelColor = ChannelColors[conversation?.channel ?? 'sms'] ?? {
    bg: Colors.gray100,
    text: Colors.gray600,
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: conversation?.patient?.name ?? conversation?.subject ?? 'Conversation',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
          ),
          headerRight: () =>
            conversation?.patient ? (
              <TouchableOpacity
                onPress={() => router.push(`/patients/${conversation.patient!.id}`)}
                style={{ padding: 4 }}
              >
                <Ionicons name="person-circle-outline" size={24} color={Colors.primary} />
              </TouchableOpacity>
            ) : undefined,
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={90}
        >
          {/* Channel badge */}
          {conversation && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 6,
                gap: 6,
                backgroundColor: channelColor.bg,
              }}
            >
              <Ionicons
                name={channelIcons[conversation.channel] ?? 'chatbubble-outline'}
                size={13}
                color={channelColor.text}
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: channelColor.text, textTransform: 'uppercase' }}>
                {conversation.channel}
              </Text>
              <Badge
                label={conversation.status}
                bg={Colors.white}
                color={channelColor.text}
                size="sm"
              />
            </View>
          )}

          {/* Messages */}
          {isLoading ? (
            <LoadingSpinner fullScreen message="Loading messages…" />
          ) : (
            <FlatList
              ref={listRef}
              data={messages ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
              onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                  <Ionicons name="chatbubbles-outline" size={40} color={Colors.gray300} />
                  <Text style={{ fontSize: 14, color: Colors.textMuted, marginTop: 12 }}>
                    No messages yet
                  </Text>
                </View>
              }
            />
          )}

          {/* Composer */}
          {conversation?.status !== 'resolved' && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                padding: 12,
                gap: 8,
                backgroundColor: Colors.white,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: Colors.gray100,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  fontSize: 15,
                  color: Colors.text,
                  maxHeight: 100,
                }}
                placeholder="Type a message…"
                placeholderTextColor={Colors.textMuted}
                value={messageText}
                onChangeText={setMessageText}
                multiline
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!messageText.trim() || sendMessage.isPending}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: messageText.trim() ? Colors.primary : Colors.gray200,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={messageText.trim() ? Colors.white : Colors.gray400}
                />
              </TouchableOpacity>
            </View>
          )}
          {conversation?.status === 'resolved' && (
            <View
              style={{
                padding: 12,
                backgroundColor: Colors.successBg,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, color: Colors.success, fontWeight: '500' }}>
                This conversation is resolved
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}
