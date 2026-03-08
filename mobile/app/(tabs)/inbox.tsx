import React, { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useConversations } from '@/hooks/useConversations'
import { ConversationCard } from '@/components/conversations/ConversationCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Colors } from '@/constants/colors'
import type { ConversationStatus, ConversationChannel } from '@/types'

type StatusFilter = 'all' | ConversationStatus
type ChannelFilter = 'all' | ConversationChannel

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
]

const CHANNEL_FILTERS: { id: ChannelFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'All', icon: 'chatbubbles-outline' },
  { id: 'sms', label: 'SMS', icon: 'chatbubble-outline' },
  { id: 'email', label: 'Email', icon: 'mail-outline' },
  { id: 'voice', label: 'Voice', icon: 'call-outline' },
]

export default function InboxScreen() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')

  const { data: conversations, isLoading, refetch, isRefetching } = useConversations({
    status: statusFilter === 'all' ? undefined : statusFilter,
    channel: channelFilter === 'all' ? undefined : channelFilter,
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom']}>
      {/* Status tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          paddingHorizontal: 12,
        }}
      >
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setStatusFilter(f.id)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 10,
              borderBottomWidth: 2,
              borderBottomColor: statusFilter === f.id ? Colors.primary : 'transparent',
              marginHorizontal: 2,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: statusFilter === f.id ? '700' : '500',
                color: statusFilter === f.id ? Colors.primary : Colors.textSecondary,
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Channel filter chips */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        }}
      >
        {CHANNEL_FILTERS.map((f) => {
          const active = channelFilter === f.id
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setChannelFilter(f.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 99,
                backgroundColor: active ? Colors.primaryBg : Colors.gray100,
                borderWidth: 1,
                borderColor: active ? Colors.primary : 'transparent',
              }}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={active ? Colors.primary : Colors.textSecondary}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? '600' : '400',
                  color: active ? Colors.primary : Colors.textSecondary,
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen message="Loading conversations…" />
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationCard conversation={item} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              title="No conversations"
              description="Conversations will appear here when patients reach out."
              icon={<Ionicons name="chatbubbles-outline" size={48} color={Colors.gray300} />}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}
