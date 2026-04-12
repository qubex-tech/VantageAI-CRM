import React, { useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking, useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { format } from 'date-fns'
import { CallAnalysisCard } from '@/components/calls/CallAnalysisCard'
import { CallTranscript } from '@/components/calls/CallTranscript'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import { useCall, useMarkCallReviewed } from '@/hooks/useCalls'
import type { CallsStackParamList } from '@/navigation/types'

type RouteT = RouteProp<CallsStackParamList, 'CallDetail'>

function formatDuration(ms?: number): string {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}s`
  return `${m}m ${sec}s`
}

const STATUS_COLOR: Record<string, string> = {
  completed: colors.success,
  ended:     colors.textMuted,
  'in-progress': colors.accent,
  error:     colors.error,
}

export function CallDetailScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteT>()
  const { callId } = route.params
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  const { data, isLoading, error } = useCall(callId)
  const markReviewed = useMarkCallReviewed()

  // Debug: log call fetch result
  useEffect(() => {
    if (data !== undefined) {
      console.log('[CallDetail] data received:', { callId, hasCall: !!data?.call, callStatus: data?.call?.call_status })
    }
    if (error) {
      console.error('[CallDetail] fetch error:', { callId, error: (error as any)?.message })
    }
  }, [data, error, callId])

  // Auto-mark reviewed when screen opens
  useEffect(() => {
    markReviewed.mutate(callId)
  }, [callId])

  const call = data?.call
  const startTime = call?.start_timestamp ? format(new Date(call.start_timestamp), 'MMM d, yyyy · h:mm a') : '—'
  const duration = formatDuration(call?.duration_ms)
  const statusColor = STATUS_COLOR[call?.call_status ?? ''] ?? colors.textMuted
  const callerId = call?.from_number
    ?? (call?.metadata as any)?.from_number
    ?? (call?.metadata as any)?.caller_id
    ?? (call?.call_type === 'web_call' ? 'Web call' : 'Unknown caller')

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{callerId}</Text>
          <Text style={styles.headerSub}>{startTime}</Text>
        </View>
        {call?.recording_url && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => Linking.openURL(call.recording_url!)}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle-outline" size={20} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.headerBorder} />

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.accent} />
      ) : !call ? (
        <View style={styles.loader}>
          <Text style={styles.errorText}>
            {error ? `Error: ${(error as any)?.message ?? 'Failed to load call'}` : 'Call not found'}
          </Text>
          <Text style={[styles.errorText, { fontSize: 11, marginTop: 4, color: colors.textMuted }]}>
            ID: {callId}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
          showsVerticalScrollIndicator={false}
        >
          {/* Meta cards */}
          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Status</Text>
              <View style={styles.metaValueRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.metaValue, { color: statusColor }]}>
                  {call.call_status.charAt(0).toUpperCase() + call.call_status.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>{duration}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Type</Text>
              <Text style={styles.metaValue}>{call.call_type === 'web_call' ? 'Web' : 'Phone'}</Text>
            </View>
          </View>

          {/* AI Analysis */}
          {call.call_analysis && Object.keys(call.call_analysis).length > 0 && (
            <CallAnalysisCard analysis={call.call_analysis} />
          )}

          {/* Transcript */}
          {call.transcript && <CallTranscript transcript={call.transcript} />}

          {/* Links */}
          {call.public_log_url && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(call.public_log_url!)}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={15} color={colors.accent} />
              <Text style={styles.linkText}>View full call log</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  headerTablet: { paddingHorizontal: spacing.xxl },
  headerBorder: { height: 1, backgroundColor: colors.border },
  backBtn:      { padding: spacing.xs },
  headerInfo:   { flex: 1 },
  headerTitle:  { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  headerSub:    { fontSize: fontSize.xs, color: colors.textMuted },
  iconBtn: {
    width: 34, height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: fontSize.base, color: colors.textMuted },

  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  contentTablet: { paddingHorizontal: spacing.xxl, maxWidth: 720, alignSelf: 'center', width: '100%' },

  metaRow: { flexDirection: 'row', gap: spacing.sm },
  metaCard: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
    alignItems: 'center',
  },
  metaLabel:    { fontSize: fontSize.xxs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: fontWeight.semibold },
  metaValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaValue:    { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },

  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accentSurface,
  },
  linkText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.accent },
})
