import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { patientPhone, searchPatients } from '@/services/patients'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { PatientsStackParamList } from '@/navigation/types'
import type { PatientSummary } from '@/types'

type Nav = NativeStackNavigationProp<PatientsStackParamList, 'PatientsSearch'>

export function PatientsSearchScreen() {
  const navigation = useNavigation<Nav>()
  const [q, setQ] = useState('')
  const debounced = useDebouncedValue(q.trim(), 250)

  const { data, isFetching } = useQuery({
    queryKey: ['patients-search', debounced],
    queryFn: () => searchPatients(debounced),
    enabled: debounced.length >= 2,
  })

  const patients = data?.patients ?? []

  const openPatient = (patient: PatientSummary) => {
    navigation.navigate('PatientDetail', {
      patientId: patient.id,
      patientName: patient.name,
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Search your practice chart and start Aria or Index ring dictation.</Text>
      <TextInput
        style={styles.input}
        placeholder="Search by name, phone, or email"
        placeholderTextColor={colors.textMuted}
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      {isFetching ? <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.accent} /> : null}
      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={patients.length === 0 ? styles.emptyList : undefined}
        renderItem={({ item }) => {
          const phone = patientPhone(item)
          return (
            <Pressable style={styles.row} onPress={() => openPatient(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {[phone, item.email].filter(Boolean).join(' · ') || 'No contact info'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {debounced.length >= 2
              ? 'No patients found'
              : 'Type at least 2 characters to search'}
          </Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
    backgroundColor: colors.bgSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
  emptyList: { flexGrow: 1 },
  empty: { marginTop: spacing.xl, textAlign: 'center', color: colors.textMuted },
})
