import React, { useCallback } from 'react'
import {
  View, FlatList, StyleSheet, Text,
  RefreshControl, useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CallItem } from '@/components/calls/CallItem'
import { EmptyState } from '@/components/common/EmptyState'
import { useCalls } from '@/hooks/useCalls'
import { useAuthStore } from '@/store/authStore'
import { colors, spacing, fontSize, fontWeight } from '@/constants/theme'
import type { CallsStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<CallsStackParamList, 'CallsList'>

export function CallsScreen() {
  const navigation = useNavigation<Nav>()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const { user } = useAuthStore()
  const practiceName = user?.practiceName ?? null

  const { data, isLoading, refetch, isRefetching, isError, error } = useCalls()
  const calls = data?.calls ?? []
  const reviewedIds = new Set(data?.reviewedCallIds ?? [])
  const debugMsg = (data as any)?.debug ?? null
  const unreviewed = calls.filter((c) => !reviewedIds.has(c.call_id)).length

  // Debug: log when data changes
  React.useEffect(() => {
    if (data !== undefined) {
      console.log('[CallsScreen] data received:', JSON.stringify({ callCount: calls.length, debug: debugMsg, isError }))
    }
  }, [data])

  const handlePress = useCallback((id: string) => {
    navigation.navigate('CallDetail', { callId: id })
  }, [navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        {practiceName && <Text style={styles.practiceName}>{practiceName}</Text>}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Calls</Text>
          {unreviewed > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{unreviewed > 99 ? '99+' : unreviewed}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>Voice conversations via AI agent</Text>
      </View>
      <View style={styles.divider} />

      <FlatList
        data={calls}
        keyExtractor={(c) => c.call_id}
        renderItem={({ item }) => (
          <CallItem
            call={item}
            reviewed={reviewedIds.has(item.call_id)}
            onPress={() => handlePress(item.call_id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="call-outline"
              title={isError ? 'Could not load calls' : 'No calls yet'}
              subtitle={
                isError
                  ? String((error as any)?.message ?? 'Unknown error')
                  : debugMsg
                  ? debugMsg
                  : 'AI-agent call recordings will appear here.'
              }
            />
          ) : null
        }
        contentContainerStyle={calls.length === 0 ? styles.emptyContainer : undefined}
        style={[styles.list, isTablet && styles.listTablet]}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
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
    marginBottom: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title:    { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  countBadge: {
    backgroundColor: colors.accent,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.white },
  subtitle:  { fontSize: fontSize.sm, color: colors.textMuted },
  divider:   { height: 1, backgroundColor: colors.border },
  separator: { height: 1, backgroundColor: colors.bgSubtle, marginLeft: 74 },
  list:       { flex: 1 },
  listTablet: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  emptyContainer: { flexGrow: 1 },
})
