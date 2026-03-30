import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/theme'

interface Props {
  transcript: string
}

interface TranscriptLine {
  speaker: 'agent' | 'user' | 'unknown'
  text: string
}

function parseTranscript(raw: string): TranscriptLine[] {
  return raw.split('\n').filter(Boolean).map((line) => {
    if (/^agent:/i.test(line)) return { speaker: 'agent' as const, text: line.replace(/^agent:\s*/i, '') }
    if (/^user:/i.test(line))  return { speaker: 'user'  as const, text: line.replace(/^user:\s*/i, '') }
    return { speaker: 'unknown' as const, text: line }
  })
}

export function CallTranscript({ transcript }: Props) {
  const [expanded, setExpanded] = useState(false)
  const lines = parseTranscript(transcript)
  const visible = expanded ? lines : lines.slice(0, 6)

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.headerTitle}>Transcript</Text>
          <Text style={styles.headerCount}>{lines.length} lines</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {visible.map((line, i) => (
            <View key={i} style={[styles.line, line.speaker === 'agent' && styles.lineAgent]}>
              <Text style={[styles.speaker, line.speaker === 'agent' ? styles.speakerAgent : styles.speakerUser]}>
                {line.speaker === 'agent' ? 'AI' : line.speaker === 'user' ? 'Patient' : ''}
              </Text>
              <Text style={styles.lineText}>{line.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.bgSubtle,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  headerCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  body: { padding: spacing.lg, gap: spacing.sm },
  line: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lineAgent: {},
  speaker: {
    width: 44,
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.semibold,
    paddingTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  speakerAgent: { color: colors.accent },
  speakerUser:  { color: colors.textMuted },
  lineText:     { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
})
