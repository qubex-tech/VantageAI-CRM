import React, { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTasks } from '@/hooks/useTasks'
import { TaskCard } from '@/components/tasks/TaskCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Colors } from '@/constants/colors'

type Filter = 'mine' | 'all' | 'overdue'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'mine', label: 'My Tasks' },
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
]

function getFilterParams(filter: Filter) {
  switch (filter) {
    case 'mine':
      return { assignedTo: 'me', status: 'pending' }
    case 'overdue':
      return { dueDate: 'overdue' }
    default:
      return {}
  }
}

export default function TasksScreen() {
  const [filter, setFilter] = useState<Filter>('mine')
  const router = useRouter()
  const params = getFilterParams(filter)
  const { data: tasks, isLoading, refetch, isRefetching } = useTasks(params)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom']}>
      {/* Filter tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          paddingHorizontal: 12,
        }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 10,
              borderBottomWidth: 2,
              borderBottomColor: filter === f.id ? Colors.primary : 'transparent',
              marginHorizontal: 2,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: filter === f.id ? '700' : '500',
                color: filter === f.id ? Colors.primary : Colors.textSecondary,
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Spacer + New Task button */}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.push('/tasks/new')}
          style={{
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: Colors.primaryBg,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Ionicons name="add" size={16} color={Colors.primary} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }}>New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen message="Loading tasks…" />
      ) : (
        <FlatList
          data={tasks ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TaskCard task={item} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              title={filter === 'mine' ? 'No pending tasks' : 'No tasks found'}
              description={
                filter === 'mine'
                  ? "You're all caught up! No tasks assigned to you."
                  : filter === 'overdue'
                  ? 'No overdue tasks. Great work!'
                  : 'No tasks have been created yet.'
              }
              icon={<Ionicons name="checkmark-circle-outline" size={48} color={Colors.gray300} />}
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
