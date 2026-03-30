import React, { useCallback } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { EmptyState } from '@/components/common/EmptyState'
import { useNotifications } from '@/hooks/useNotifications'
import { colors, spacing, fontSize, fontWeight } from '@/constants/theme'
import type { MobileNotification } from '@/types'
import type { RootTabParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<RootTabParamList>

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>()
  const [unreadOnly, setUnreadOnly] = React.useState(false)

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isFetching,
  } = useNotifications(unreadOnly)

  const notifications = data?.pages.flatMap((p) => p.notifications) ?? []

  const handlePress = useCallback(
    (notification: MobileNotification) => {
      // Navigate to the conversation inside the Inbox tab
      navigation.navigate('Inbox', {
        screen: 'ConversationDetail',
        params: { conversationId: notification.conversationId },
      } as any)
    },
    [navigation]
  )

  const renderItem = useCallback(
    ({ item }: { item: MobileNotification }) => (
      <NotificationItem notification={item} onPress={handlePress} />
    ),
    [handlePress]
  )

  const keyExtractor = useCallback((item: MobileNotification) => item.id, [])

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity
          style={[styles.filterBtn, unreadOnly && styles.filterBtnActive]}
          onPress={() => setUnreadOnly((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterLabel, unreadOnly && styles.filterLabelActive]}>
            {unreadOnly ? 'Unread only' : 'All'}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={notifications.length === 0 ? styles.emptyContent : undefined}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title={unreadOnly ? 'All caught up!' : 'No notifications'}
              subtitle={
                unreadOnly
                  ? 'You have no unread messages right now.'
                  : 'New messages and activity will appear here.'
              }
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={styles.footerSpinner} color={colors.accent} />
            ) : null
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
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
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterBtnActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  filterLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  filterLabelActive: {
    color: colors.accent,
    fontWeight: fontWeight.semibold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContent: {
    flexGrow: 1,
  },
  footerSpinner: {
    paddingVertical: spacing.lg,
  },
})
