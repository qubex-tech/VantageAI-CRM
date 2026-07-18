import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { EmptyState } from '@/components/common/EmptyState'
import { useAriaSchedule, useAriaSessions, useInvalidateAria } from '@/hooks/useAria'
import { createAriaSession } from '@/services/aria'
import { getApiErrorMessage } from '@/services/apiClient'
import { useAuthStore } from '@/store/authStore'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { AriaStackParamList } from '@/navigation/types'
import type { AriaScheduleAppointment, AriaSession } from '@/types'

type Nav = NativeStackNavigationProp<AriaStackParamList, 'AriaHome'>

export function AriaHomeScreen() {
  const navigation = useNavigation<Nav>()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const { user } = useAuthStore()
  const practiceName = user?.practiceName ?? null
  const invalidate = useInvalidateAria()

  const schedule = useAriaSchedule()
  const drafts = useAriaSessions()
  const [startingId, setStartingId] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      void schedule.refetch()
      void drafts.refetch()
    }, [schedule.refetch, drafts.refetch])
  )

  const appointments = schedule.data?.appointments ?? []
  const continueSessions = (drafts.data?.sessions ?? []).filter((s) =>
    ['ready_for_review', 'uploading', 'transcribing', 'generating', 'failed'].includes(s.status)
  )

  const startForAppointment = async (appt: AriaScheduleAppointment) => {
    setStartingId(appt.id)
    try {
      const { session } = await createAriaSession({
        patientId: appt.patient.id,
        appointmentId: appt.id,
        mode: 'hybrid',
        consent: true,
      })
      invalidate()
      navigation.navigate('AriaCapture', {
        sessionId: session.id,
        patientName: appt.patient.name,
        visitType: appt.visitType,
      })
    } catch (err) {
      Alert.alert('Aria', getApiErrorMessage(err, 'Could not start session'))
    } finally {
      setStartingId(null)
    }
  }

  const openSession = (session: AriaSession) => {
    if (session.status === 'ready_for_review' || session.status === 'failed') {
      navigation.navigate('AriaReview', { sessionId: session.id })
      return
    }
    if (session.status === 'signed') {
      navigation.navigate('AriaSigned', { sessionId: session.id })
      return
    }
    navigation.navigate('AriaCapture', {
      sessionId: session.id,
      patientName: session.patient?.name || 'Patient',
      visitType: null,
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        {practiceName ? <Text style={styles.practiceName}>{practiceName}</Text> : null}
        <Text style={styles.title}>Aria</Text>
        <Text style={styles.subtitle}>AI scribe for visit notes</Text>
      </View>
      <View style={styles.divider} />

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={schedule.isRefetching || drafts.isRefetching}
            onRefresh={() => {
              void schedule.refetch()
              void drafts.refetch()
            }}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('AriaPatientPicker')}
            >
              <Text style={styles.secondaryBtnText}>Dictation only</Text>
            </Pressable>

            {continueSessions.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Continue</Text>
                {continueSessions.map((session) => (
                  <Pressable
                    key={session.id}
                    style={styles.draftCard}
                    onPress={() => openSession(session)}
                  >
                    <Text style={styles.draftName}>{session.patient?.name || 'Patient'}</Text>
                    <Text style={styles.draftMeta}>{session.status.replace(/_/g, ' ')}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Today</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.apptRow}>
            <View style={styles.apptInfo}>
              <Text style={styles.apptTime}>{format(new Date(item.startTime), 'h:mm a')}</Text>
              <Text style={styles.apptName}>{item.patient.name}</Text>
              <Text style={styles.apptMeta}>{item.visitType}</Text>
            </View>
            <Pressable
              style={styles.startBtn}
              disabled={startingId === item.id}
              onPress={() => void startForAppointment(item)}
            >
              {startingId === item.id ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.startBtnText}>Start</Text>
              )}
            </Pressable>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !schedule.isLoading ? (
            <EmptyState
              icon="mic-outline"
              title={schedule.isError ? 'Could not load schedule' : 'No visits today'}
              subtitle={
                schedule.isError
                  ? getApiErrorMessage(schedule.error, 'Pull to refresh.')
                  : 'Start a dictation with Aria anytime.'
              }
            />
          ) : null
        }
        contentContainerStyle={appointments.length === 0 ? styles.emptyContainer : undefined}
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
    gap: 2,
  },
  headerTablet: { paddingHorizontal: spacing.xxl },
  practiceName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.accent,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: colors.border },
  list: { flex: 1 },
  listTablet: { alignSelf: 'center', width: '100%', maxWidth: 720 },
  listHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
  },
  secondaryBtnText: {
    color: colors.text,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.base,
  },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  draftCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.accentLight,
  },
  draftName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  draftMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  apptInfo: { flex: 1, gap: 2 },
  apptTime: { fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.medium },
  apptName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  apptMeta: { fontSize: fontSize.sm, color: colors.textSecondary },
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  startBtnText: { color: colors.white, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  separator: { height: 1, backgroundColor: colors.divider, marginLeft: spacing.lg },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
})
