import React, { useCallback } from 'react'
import {
  View,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Text,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { ConversationItem } from '@/components/inbox/ConversationItem'
import { StatusTabs, ChannelFilter } from '@/components/inbox/FilterBar'
import { EmptyState } from '@/components/common/EmptyState'
import { UnreadBadge } from '@/components/common/Badge'
import { useConversations, useUnreadCount } from '@/hooks/useConversations'
import { useInboxStore } from '@/store/inboxStore'
import { colors, spacing, fontSize, fontWeight } from '@/constants/theme'
import type { Conversation } from '@/types'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { InboxStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<InboxStackParamList, 'InboxList'>

export function InboxScreen() {
  const navigation = useNavigation<Nav>()
  const { filters, setFilter } = useInboxStore()

  const { data: conversations = [], isLoading, isFetching, refetch } = useConversations({
    status: filters.status,
    channel: filters.channel,
    assignee: filters.assignee,
    search: filters.search || undefined,
  })

  const { data: unreadCount = 0 } = useUnreadCount()

  const handleConversationPress = useCallback(
    (conversation: Conversation) => {
      navigation.navigate('ConversationDetail', { conversationId: conversation.id })
    },
    [navigation]
  )

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationItem conversation={item} onPress={handleConversationPress} />
    ),
    [handleConversationPress]
  )

  const keyExtractor = useCallback((item: Conversation) => item.id, [])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Inbox</Text>
          {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={filters.search}
            onChangeText={(v) => setFilter('search', v)}
            placeholder="Search patients, messages…"
            placeholderTextColor={colors.textMuted}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Status tabs */}
      <StatusTabs
        selected={filters.status}
        onChange={(s) => setFilter('status', s)}
      />

      {/* Channel filter */}
      <ChannelFilter
        selected={filters.channel}
        onChange={(c) => setFilter('channel', c)}
      />

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={conversations.length === 0 ? styles.emptyContent : undefined}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations"
              subtitle={
                filters.status
                  ? `No ${filters.status} conversations match your filters.`
                  : 'Your inbox is empty.'
              }
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContent: {
    flexGrow: 1,
  },
})
