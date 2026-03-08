import React, { useState } from 'react'
import { View, FlatList, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { usePatients } from '@/hooks/usePatients'
import { PatientCard } from '@/components/patients/PatientCard'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Colors } from '@/constants/colors'

export default function PatientsScreen() {
  const [search, setSearch] = useState('')
  const { data: patients, isLoading, refetch, isRefetching } = usePatients(search || undefined)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom']}>
      {/* Search */}
      <View style={{ padding: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
        <Input
          placeholder="Search by name, phone, or email…"
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search-outline" size={16} color={Colors.textMuted} />}
          returnKeyType="search"
        />
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen message="Loading patients…" />
      ) : (
        <FlatList
          data={patients ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PatientCard patient={item} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              title={search ? 'No patients found' : 'No patients yet'}
              description={
                search
                  ? `No results for "${search}"`
                  : 'Patients will appear here once added to your practice.'
              }
              icon={<Ionicons name="people-outline" size={48} color={Colors.gray300} />}
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
