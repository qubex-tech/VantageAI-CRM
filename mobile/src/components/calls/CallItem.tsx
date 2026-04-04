import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import type { RetellCall } from '@/types'

interface Props {
  call: RetellCall
  reviewed: boolean
  onPress: () => void
}

const STATUS_CONFIG = {
  ended:      { label: 'Ended',       color: colors.textMuted,  bg: colors.bgMuted },
  completed:  { label: 'Completed',   color: colors.success,    bg: colors.successLight },
  'in-progress': { label: 'Live',     color: colors.accent,     bg: colors.accentLight },
  registered: { label: 'Registered',  color: colors.textMuted,  bg: colors.bgMuted },
  error:      { label: 'Error',       color: colors.error,      bg: colors.errorLight },
}

function formatDuration(ms?: number): string {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}s`
  return `${m}m ${sec}s`
}

function extractPatientLabel(call: RetellCall): string {
  const data = call.call_analysis?.custom_analysis_data as Record<string, unknown> | undefined

  // Extract patient name from custom_analysis_data (check many possible field names)
  const rawName = (
    data?.patient_name ??
    data?.patientName ??
    data?.['Patient Name'] ??
    data?.caller_name ??
    data?.callerName ??
    data?.['Caller Name'] ??
    data?.full_name ??
    data?.['Full Name'] ??
    data?.name ??
    data?.Name ??
    null
  ) as string | null

  // Parse name from call summary as fallback: "The caller, {Name}, a/an ..."
  const summary = call.call_analysis?.call_summary ?? ''
  const summaryMatch = summary.match(/[Tt]he caller,\s+([^,]+),/)
  const nameFromSummary = summaryMatch ? summaryMatch[1].trim() : null

  const patientName = rawName || nameFromSummary

  // Extract patient type
  const rawType = (
    data?.patient_type ??
    data?.patientType ??
    data?.patient_status ??
    data?.['Patient Type'] ??
    null
  ) as string | null

  const patientType = rawType
    ? /new/i.test(rawType) ? 'New Patient' : 'Existing Patient'
    : null

  if (patientName && patientType) return `${patientType}: ${patientName}`
  if (patientName) return patientName
  if (patientType) return patientType

  // Fallback to phone number or call type
  return (call.metadata as any)?.from_number
    ?? (call.metadata as any)?.caller_id
    ?? (call.call_type === 'web_call' ? 'Web call' : 'Unknown caller')
}

export function CallItem({ call, reviewed, onPress }: Props) {
  const status = STATUS_CONFIG[call.call_status] ?? STATUS_CONFIG.ended
  const hasUnread = !reviewed
  const time = call.start_timestamp
    ? format(new Date(call.start_timestamp), 'MMM d, h:mm a')
    : '—'
  const duration = formatDuration(call.duration_ms)
  const callerId = extractPatientLabel(call)
  const summary = call.call_analysis?.call_summary

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={styles.row}>
      <View style={[styles.unreadBar, hasUnread && styles.unreadBarActive]} />

      {/* Icon circle */}
      <View style={[styles.iconCircle, call.call_type === 'web_call' && styles.iconCircleWeb]}>
        <Ionicons
          name={call.call_type === 'web_call' ? 'globe-outline' : 'call-outline'}
          size={18}
          color={call.call_type === 'web_call' ? colors.email : colors.success}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.caller, hasUnread && styles.callerUnread]} numberOfLines={1}>
            {callerId}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>

        {summary ? (
          <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
        ) : (
          <Text style={styles.noSummary}>No summary available</Text>
        )}

        <View style={styles.bottomRow}>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <View style={styles.duration}>
            <Ionicons name="time-outline" size={11} color={colors.textMuted} />
            <Text style={styles.durationText}>{duration}</Text>
          </View>
          {call.call_analysis?.call_successful === false && (
            <View style={[styles.statusPill, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.statusText, { color: colors.error }]}>Unsuccessful</Text>
            </View>
          )}
          {call.call_analysis?.in_voicemail && (
            <View style={[styles.statusPill, { backgroundColor: colors.bgMuted }]}>
              <Text style={[styles.statusText, { color: colors.textMuted }]}>Voicemail</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    paddingLeft: spacing.lg,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  unreadBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    borderRadius: 99,
    backgroundColor: 'transparent',
  },
  unreadBarActive: { backgroundColor: colors.accent },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconCircleWeb: { backgroundColor: colors.emailLight },

  content: { flex: 1, gap: 4 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  caller:       { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.text },
  callerUnread: { fontWeight: fontWeight.semibold },
  time:         { fontSize: fontSize.xs, color: colors.textMuted },
  summary:      { fontSize: fontSize.sm, color: colors.textSecondary },
  noSummary:    { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic' },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusText: { fontSize: fontSize.xxs, fontWeight: fontWeight.semibold },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  durationText: { fontSize: fontSize.xs, color: colors.textMuted },
})
