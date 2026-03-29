import React, { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format, startOfDay, endOfDay, addDays, subDays } from 'date-fns'
import { useAppointments } from '@/hooks/useAppointments'
import { AppointmentCard } from '@/components/appointments/AppointmentCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Colors } from '@/constants/colors'
import type { Appointment } from '@/types'

type Filter = 'today' | 'upcoming' | 'past' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
]

function getFilterParams(filter: Filter) {
  const now = new Date()
  switch (filter) {
    case 'today':
      return {
        from: format(startOfDay(now), 'yyyy-MM-dd'),
        to: format(endOfDay(now), 'yyyy-MM-dd'),
      }
    case 'upcoming':
      return { from: format(addDays(now, 1), 'yyyy-MM-dd') }
    case 'past':
      return { to: format(subDays(now, 1), 'yyyy-MM-dd') }
    default:
      return {}
  }
}

export default function AppointmentsScreen() {
  const [filter, setFilter] = useState<Filter>('today')
  const params = getFilterParams(filter)
  const { data: appointments, isLoading, refetch, isRefetching } = useAppointments(params)

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
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen message="Loading appointments…" />
      ) : (
        <FlatList
          data={appointments ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AppointmentCard appointment={item} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              title="No appointments"
              description={`No ${filter === 'all' ? '' : filter + ' '}appointments found.`}
              icon={<Ionicons name="calendar-outline" size={48} color={Colors.gray300} />}
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
