import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'
import type { CallAnalysis } from '@/types'

interface Props {
  analysis: CallAnalysis
}

export function CallAnalysisCard({ analysis }: Props) {
  const { call_summary, user_sentiment, call_successful, in_voicemail, custom_analysis_data } = analysis
  const customFields = custom_analysis_data ? Object.entries(custom_analysis_data) : []

  const sentimentColor =
    user_sentiment === 'Positive' ? colors.success :
    user_sentiment === 'Negative' ? colors.error :
    colors.textMuted

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="sparkles-outline" size={15} color={colors.accent} />
        <Text style={styles.cardTitle}>AI Analysis</Text>
      </View>

      {call_summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Summary</Text>
          <Text style={styles.summaryText}>{call_summary}</Text>
        </View>
      ) : null}

      <View style={styles.chips}>
        {call_successful !== undefined && (
          <View style={[styles.chip, call_successful ? styles.chipSuccess : styles.chipError]}>
            <Ionicons
              name={call_successful ? 'checkmark-circle' : 'close-circle'}
              size={13}
              color={call_successful ? colors.success : colors.error}
            />
            <Text style={[styles.chipText, { color: call_successful ? colors.success : colors.error }]}>
              {call_successful ? 'Successful' : 'Unsuccessful'}
            </Text>
          </View>
        )}

        {in_voicemail && (
          <View style={[styles.chip, styles.chipNeutral]}>
            <Ionicons name="voicemail-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.chipText, { color: colors.textMuted }]}>Voicemail</Text>
          </View>
        )}

        {user_sentiment ? (
          <View style={[styles.chip, styles.chipNeutral]}>
            <Ionicons name="happy-outline" size={13} color={sentimentColor} />
            <Text style={[styles.chipText, { color: sentimentColor }]}>{user_sentiment}</Text>
          </View>
        ) : null}
      </View>

      {customFields.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Extracted Data</Text>
          {customFields.map(([key, val]) => (
            <View key={key} style={styles.dataRow}>
              <Text style={styles.dataKey}>{key.replace(/_/g, ' ')}</Text>
              <Text style={styles.dataVal}>{String(val ?? '—')}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.bgSubtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },

  section: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  chipSuccess: { backgroundColor: colors.successLight, borderColor: '#86EFAC' },
  chipError:   { backgroundColor: colors.errorLight,   borderColor: '#FCA5A5' },
  chipNeutral: { backgroundColor: colors.bgMuted,      borderColor: colors.border },
  chipText:    { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  dataRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  dataKey: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1, textTransform: 'capitalize' },
  dataVal: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium, flex: 1, textAlign: 'right' },
})
