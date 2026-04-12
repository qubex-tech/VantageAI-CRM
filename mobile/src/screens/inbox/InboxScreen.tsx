import React, { useCallback, useState } from 'react'
import {
  View, FlatList, TextInput, StyleSheet, Text,
  RefreshControl, TouchableOpacity, useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { ConversationItem } from '@/components/inbox/ConversationItem'
import { FilterBar } from '@/components/inbox/FilterBar'
import { EmptyState } from '@/components/common/EmptyState'
import { useConversations, useUnreadCount } from '@/hooks/useConversations'
import { useInboxStore } from '@/store/inboxStore'
import { useAuthStore } from '@/store/authStore'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import type { InboxStackParamList } from '@/navigation/types'
import type { ConversationStatus, Channel } from '@/types'

type Nav = NativeStackNavigationProp<InboxStackParamList, 'InboxList'>
type StatusFilter = 'all' | ConversationStatus
type ChannelFilter = 'all' | Channel

export function InboxScreen() {
  const navigation = useNavigation<Nav>()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  const { filters, setFilter } = useInboxStore()
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const { user } = useAuthStore()
  const practiceName = user?.practiceName ?? null

  const queryFilters = {
    status: filters.status !== 'all' ? filters.status : undefined,
    channel: filters.channel !== 'all' ? filters.channel : undefined,
    search: search.trim() || undefined,
  }

  const { data, isLoading, refetch, isRefetching } = useConversations(queryFilters)

  useFocusEffect(useCallback(() => { refetch() }, [refetch]))
  const { data: unreadCount = 0 } = useUnreadCount()
  const conversations = Array.isArray(data) ? data : []

  const handleConversation = useCallback((id: string) => {
    navigation.navigate('ConversationDetail', { conversationId: id })
  }, [navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <View style={styles.headerTop}>
          <View>
            {practiceName && <Text style={styles.practiceName}>{practiceName}</Text>}
            <View style={styles.titleRow}>
              <Text style={styles.title}>Inbox</Text>
              {unreadCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => refetch()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.refreshBtn}
          >
            <Ionicons
              name="refresh-outline"
              size={22}
              color={isRefetching ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search patients, messages…"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <FilterBar
        status={filters.status as StatusFilter}
        channel={filters.channel as ChannelFilter}
        onStatusChange={(s) => setFilter('status', s)}
        onChannelChange={(c) => setFilter('channel', c)}
      />

      {/* Divider */}
      <View style={styles.divider} />

      {/* List */}
      <View style={styles.flex}>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem conversation={item} onPress={() => handleConversation(item.id)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                icon="chatbubbles-outline"
                title={search ? 'No results' : 'Inbox is empty'}
                subtitle={search ? 'Try a different search term.' : 'New conversations will appear here.'}
              />
            ) : null
          }
          contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
          style={[styles.list, isTablet && styles.listTablet]}
        />

        {/* WhatsApp-style FAB */}
        <TouchableOpacity
          style={[styles.fab, isTablet && styles.fabTablet]}
          onPress={() => navigation.navigate('NewConversation')}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  headerTablet: { paddingHorizontal: spacing.xxl },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  refreshBtn: {
    paddingTop: 4,
  },
  practiceName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title:    { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  countBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.white },

  flex: { flex: 1 },

  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabTablet: {
    right: spacing.xxl,
    bottom: spacing.xxl,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchBarFocused: { borderColor: colors.accent, backgroundColor: colors.bg },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    height: '100%',
  },

  divider:   { height: 1, backgroundColor: colors.border },
  separator: { height: 1, backgroundColor: colors.bgSubtle, marginLeft: 74 },

  list:       { flex: 1, backgroundColor: colors.bg },
  listTablet: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  emptyContainer: { flexGrow: 1 },
})
