import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { apiGet, getApiErrorMessage } from '@/services/apiClient'
import { createAriaSession } from '@/services/aria'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { AriaStackParamList } from '@/navigation/types'
import type { PatientSummary } from '@/types'

type Nav = NativeStackNavigationProp<AriaStackParamList, 'AriaPatientPicker'>

export function AriaPatientPickerScreen() {
  const navigation = useNavigation<Nav>()
  const [q, setQ] = useState('')
  const [startingId, setStartingId] = useState<string | null>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['aria-patient-search', q],
    queryFn: () =>
      apiGet<{ patients: PatientSummary[] }>('/api/mobile/patients', {
        search: q.trim() || undefined,
      }),
    enabled: q.trim().length >= 2,
  })

  const patients = data?.patients ?? []

  const start = async (patient: PatientSummary) => {
    setStartingId(patient.id)
    try {
      const { session } = await createAriaSession({
        patientId: patient.id,
        mode: 'dictation',
        consent: true,
      })
      navigation.replace('AriaCapture', {
        sessionId: session.id,
        patientName: patient.name,
        visitType: 'Dictation',
      })
    } catch (err) {
      Alert.alert('Aria', getApiErrorMessage(err, 'Could not start session'))
    } finally {
      setStartingId(null)
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search patients"
        placeholderTextColor={colors.textMuted}
        value={q}
        onChangeText={setQ}
        autoFocus
        autoCorrect={false}
      />
      {isFetching ? <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.accent} /> : null}
      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => void start(item)} disabled={startingId === item.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.primaryPhone ? <Text style={styles.meta}>{item.primaryPhone}</Text> : null}
            </View>
            {startingId === item.id ? <ActivityIndicator color={colors.accent} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          q.trim().length >= 2 && !isFetching ? (
            <Text style={styles.empty}>No patients found</Text>
          ) : (
            <Text style={styles.empty}>Type at least 2 characters to search</Text>
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
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
  empty: { marginTop: spacing.xl, textAlign: 'center', color: colors.textMuted },
})
