import React, { useLayoutEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, isValid } from 'date-fns'
import { fetchPatientProfile } from '@/services/patients'
import { createAriaSession } from '@/services/aria'
import { getApiErrorMessage } from '@/services/apiClient'
import { useAriaEnabled } from '@/hooks/useAria'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { PatientsStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<PatientsStackParamList, 'PatientDetail'>
type Route = RouteProp<PatientsStackParamList, 'PatientDetail'>

function formatDob(value: string | null): string {
  if (!value) return '—'
  const date = parseISO(value)
  if (!isValid(date)) return '—'
  return format(date, 'MMM d, yyyy')
}

function formatAppt(value: string): string {
  const date = parseISO(value)
  if (!isValid(date)) return value
  return format(date, 'MMM d, yyyy · h:mm a')
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

export function PatientDetailScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { patientId, patientName } = route.params
  const { enabled: ariaEnabled } = useAriaEnabled()
  const [starting, setStarting] = useState<'phone' | 'ring' | null>(null)

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['patient-profile', patientId],
    queryFn: () => fetchPatientProfile(patientId),
  })

  const patient = data?.patient

  useLayoutEffect(() => {
    navigation.setOptions({
      title: patient?.name || patientName || 'Patient',
    })
  }, [navigation, patient?.name, patientName])

  const startDictation = async (mode: 'phone' | 'ring') => {
    if (!ariaEnabled) {
      Alert.alert('Aria', 'Aria is not enabled for this practice. Enable it in CRM settings.')
      return
    }
    setStarting(mode)
    try {
      const { session } = await createAriaSession({
        patientId,
        mode: 'dictation',
        consent: true,
      })
      const name = patient?.name || patientName || 'Patient'
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Aria',
          params: {
            screen: mode === 'phone' ? 'AriaCapture' : 'AriaRingListen',
            params: {
              sessionId: session.id,
              patientName: name,
              visitType: mode === 'phone' ? 'Dictation' : 'Index ring',
            },
          },
        })
      )
    } catch (err) {
      Alert.alert('Aria', getApiErrorMessage(err, 'Could not start dictation'))
    } finally {
      setStarting(null)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (error || !patient) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{getApiErrorMessage(error, 'Could not load patient')}</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => void refetch()}>
          <Text style={styles.secondaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroName}>{patient.name}</Text>
        {patient.preferredName ? (
          <Text style={styles.heroMeta}>Preferred: {patient.preferredName}</Text>
        ) : null}
        <Text style={styles.heroMeta}>
          DOB {formatDob(patient.dateOfBirth)}
          {patient.gender ? ` · ${patient.gender}` : ''}
        </Text>
        {patient.tags.length > 0 ? (
          <View style={styles.tags}>
            {patient.tags.map((tag) => (
              <View key={tag.id} style={styles.tag}>
                <Text style={styles.tagText}>{tag.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryBtn, (!ariaEnabled || starting) && styles.btnDisabled]}
          disabled={!ariaEnabled || Boolean(starting)}
          onPress={() => void startDictation('phone')}
        >
          {starting === 'phone' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Dictate with Aria</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.ringBtn, (!ariaEnabled || starting) && styles.btnDisabled]}
          disabled={!ariaEnabled || Boolean(starting)}
          onPress={() => void startDictation('ring')}
        >
          {starting === 'ring' ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.ringBtnText}>Dictate with Index ring</Text>
          )}
        </Pressable>
        {!ariaEnabled ? (
          <Text style={styles.hint}>Aria must be enabled for this practice to dictate.</Text>
        ) : (
          <Text style={styles.hint}>
            Index ring uses your Pebble webhook secret. Start here first so the visit is bound, then
            double-click & hold on the ring.
          </Text>
        )}
      </View>

      <Section title="Contact">
        <Row label="Phone" value={patient.phone} />
        <Row label="Secondary" value={patient.secondaryPhone} />
        <Row label="Email" value={patient.email} />
        <Row label="Address" value={patient.address} />
        <Row label="Preferred channel" value={patient.preferredChannel} />
        {patient.doNotContact ? <Row label="Do not contact" value="Yes" /> : null}
      </Section>

      <Section title="Insurance">
        {patient.selfPay ? <Row label="Self pay" value="Yes" /> : null}
        <Row label="Status" value={patient.insuranceStatus} />
        {patient.insurancePolicies.length === 0 ? (
          <Text style={styles.emptySection}>No insurance policies on file</Text>
        ) : (
          patient.insurancePolicies.map((policy) => (
            <View key={policy.id} style={styles.listItem}>
              <Text style={styles.listTitle}>
                {policy.isPrimary ? 'Primary · ' : ''}
                {policy.carrierName}
              </Text>
              <Text style={styles.listMeta}>
                {[policy.planName, policy.memberId ? `Member ${policy.memberId}` : null, policy.status]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Recent appointments">
        {patient.appointments.length === 0 ? (
          <Text style={styles.emptySection}>No recent appointments</Text>
        ) : (
          patient.appointments.map((appt) => (
            <View key={appt.id} style={styles.listItem}>
              <Text style={styles.listTitle}>{formatAppt(appt.startTime)}</Text>
              <Text style={styles.listMeta}>
                {[appt.visitType, appt.status, appt.reason].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Recent notes">
        {patient.notes.length === 0 ? (
          <Text style={styles.emptySection}>No notes yet</Text>
        ) : (
          patient.notes.map((note) => (
            <View key={note.id} style={styles.listItem}>
              <Text style={styles.listTitle}>
                {note.type} · {formatAppt(note.createdAt)}
              </Text>
              <Text style={styles.noteBody} numberOfLines={4}>
                {note.content}
              </Text>
            </View>
          ))
        )}
      </Section>

      {patient.chartNotes ? (
        <Section title="Chart notes">
          <Text style={styles.noteBody}>{patient.chartNotes}</Text>
        </Section>
      ) : null}

      {isRefetching ? (
        <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.accent} />
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  hero: { marginBottom: spacing.lg },
  heroName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  heroMeta: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  tag: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagText: { fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.medium },
  actions: { gap: spacing.sm, marginBottom: spacing.xl },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  ringBtn: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accentSurface,
  },
  ringBtnText: { color: colors.accent, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.accentLight,
  },
  secondaryBtnText: { color: colors.accent, fontWeight: fontWeight.semibold },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 18 },
  errorText: { color: colors.error, textAlign: 'center' },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { marginBottom: spacing.sm },
  rowLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 2 },
  rowValue: { fontSize: fontSize.base, color: colors.text },
  listItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  listTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  listMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  noteBody: { fontSize: fontSize.sm, color: colors.text, marginTop: 4, lineHeight: 20 },
  emptySection: { fontSize: fontSize.sm, color: colors.textMuted },
})
