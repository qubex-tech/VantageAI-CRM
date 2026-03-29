import React from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { ChannelColors, Colors } from '@/constants/colors'
import type { Conversation } from '@/types'

const channelIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  sms: 'chatbubble-outline',
  email: 'mail-outline',
  secure: 'lock-closed-outline',
  voice: 'call-outline',
  video: 'videocam-outline',
}

interface ConversationCardProps {
  conversation: Conversation
}

export function ConversationCard({ conversation }: ConversationCardProps) {
  const router = useRouter()
  const channelColor = ChannelColors[conversation.channel] ?? { bg: Colors.gray100, text: Colors.gray600 }
  const iconName = channelIcons[conversation.channel] ?? 'chatbubble-outline'
  const isUnread = conversation.unreadCount > 0

  return (
    <TouchableOpacity
      onPress={() => router.push(`/conversations/${conversation.id}`)}
      activeOpacity={0.7}
    >
      <Card
        style={{
          marginHorizontal: 16,
          marginVertical: 5,
          borderLeftWidth: isUnread ? 3 : 0,
          borderLeftColor: Colors.primary,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Channel icon */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: channelColor.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={iconName} size={18} color={channelColor.text} />
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: isUnread ? '700' : '600',
                  color: Colors.text,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {conversation.patient?.name ?? conversation.subject ?? 'Unknown'}
              </Text>
              {conversation.lastMessageAt && (
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  {formatDistanceToNow(parseISO(conversation.lastMessageAt), { addSuffix: true })}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: isUnread ? Colors.textSecondary : Colors.textMuted,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {conversation.lastMessagePreview ?? 'No messages yet'}
              </Text>
              {isUnread && (
                <View
                  style={{
                    backgroundColor: Colors.primary,
                    borderRadius: 99,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 5,
                    marginLeft: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.white }}>
                    {conversation.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
        </View>
      </Card>
    </TouchableOpacity>
  )
}
