import React, { useCallback } from 'react'
import {
  View, FlatList, StyleSheet, Text, TouchableOpacity,
  RefreshControl, useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { EmptyState } from '@/components/common/EmptyState'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuthStore } from '@/store/authStore'
import { colors, spacing, fontSize, fontWeight } from '@/constants/theme'

export function NotificationsScreen() {
  const navigation = useNavigation<any>()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const { user } = useAuthStore()
  const practiceName = user?.practiceName ?? null

  const { data, isLoading, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotifications({ unreadOnly: false })

  const notifications = data?.pages.flatMap((p) => p.notifications) ?? []

  const handleNotification = useCallback((conversationId: string) => {
    navigation.navigate('Inbox', {
      screen: 'ConversationDetail',
      params: { conversationId },
    })
  }, [navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        {practiceName && <Text style={styles.practiceName}>{practiceName}</Text>}
        <Text style={styles.title}>Notifications</Text>
      </View>
      <View style={styles.divider} />

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={() => handleNotification(item.conversationId)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="notifications-outline"
              title="No notifications"
              subtitle="You're all caught up."
            />
          ) : null
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        style={[styles.list, isTablet && styles.listTablet]}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
    gap: 2,
  },
  headerTablet: { paddingHorizontal: spacing.xxl },
  practiceName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border },
  separator: { height: 1, backgroundColor: colors.bgSubtle, marginLeft: 74 },
  list: { flex: 1, backgroundColor: colors.bg },
  listTablet: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  emptyContainer: { flexGrow: 1 },
})
