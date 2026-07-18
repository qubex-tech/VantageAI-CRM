import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAriaSession } from '@/hooks/useAria'
import {
  discardActiveRecording,
  getElapsedMs,
  pauseAmbientRecording,
  resumeAmbientRecording,
  startRollingAmbient,
  stopRollingAmbient,
} from '@/lib/ariaRecorder'
import { activateKeepAwakeSafe, deactivateKeepAwakeSafe } from '@/lib/keepAwake'
import { finalizeAriaSession, uploadAriaChunk } from '@/services/aria'
import { getApiErrorMessage } from '@/services/apiClient'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { AriaStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<AriaStackParamList, 'AriaCapture'>
type Route = RouteProp<AriaStackParamList, 'AriaCapture'>

type TranscriptSegment = {
  seq: number
  text: string
}

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function AriaCaptureScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { sessionId, patientName, visitType } = route.params

  const [phase, setPhase] = useState<'idle' | 'recording' | 'paused' | 'uploading' | 'processing'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [segmentsSynced, setSegmentsSynced] = useState(0)
  const [segmentsFailed, setSegmentsFailed] = useState(0)
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const uploadChain = useRef(Promise.resolve())
  const transcriptScrollRef = useRef<ScrollView>(null)

  const { data } = useAriaSession(sessionId, {
    poll: phase === 'processing' || phase === 'uploading',
  })
  const remoteStatus = data?.session.status

  useEffect(() => {
    void activateKeepAwakeSafe('aria-capture')
    void begin()
    return () => {
      deactivateKeepAwakeSafe('aria-capture')
      if (tickRef.current) clearInterval(tickRef.current)
      void discardActiveRecording()
    }
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phase === 'recording') {
        void onPause()
      }
    })
    return () => sub.remove()
  }, [phase])

  useEffect(() => {
    if (!remoteStatus) return
    if (remoteStatus === 'ready_for_review' || remoteStatus === 'failed') {
      navigation.replace('AriaReview', { sessionId })
    }
  }, [remoteStatus, navigation, sessionId])

  useEffect(() => {
    if (liveSegments.length === 0) return
    requestAnimationFrame(() => {
      transcriptScrollRef.current?.scrollToEnd({ animated: true })
    })
  }, [liveSegments])

  const enqueueSegmentUpload = (uri: string, durationMs: number) => {
    uploadChain.current = uploadChain.current
      .then(async () => {
        const result = await uploadAriaChunk({
          sessionId,
          uri,
          kind: 'ambient',
          durationMs,
        })
        const text = (result.transcript || result.chunk?.transcript || '').trim()
        const seq = result.chunk?.seq ?? Date.now()
        if (text) {
          setLiveSegments((prev) => {
            if (prev.some((p) => p.seq === seq)) return prev
            return [...prev, { seq, text }]
          })
        }
        setSegmentsSynced((n) => n + 1)
      })
      .catch(() => {
        setSegmentsFailed((n) => n + 1)
      })
  }

  const begin = async () => {
    try {
      setError(null)
      setSegmentsSynced(0)
      setSegmentsFailed(0)
      setLiveSegments([])
      await startRollingAmbient((segment) => {
        enqueueSegmentUpload(segment.uri, segment.durationMs)
      })
      setPhase('recording')
      tickRef.current = setInterval(() => setElapsed(getElapsedMs()), 500)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start microphone'))
      setPhase('idle')
    }
  }

  const onPause = async () => {
    try {
      await pauseAmbientRecording()
      setPhase('paused')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not pause'))
    }
  }

  const onResume = async () => {
    try {
      await resumeAmbientRecording()
      setPhase('recording')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not resume'))
    }
  }

  const onStop = async () => {
    try {
      setPhase('uploading')
      if (tickRef.current) clearInterval(tickRef.current)

      const last = await stopRollingAmbient()
      await uploadChain.current.catch(() => null)

      setPhase('processing')
      const { session } = await finalizeAriaSession({
        sessionId,
        uri: last.uri,
        kind: 'ambient',
        durationMs: last.durationMs,
      })
      if (session.status === 'ready_for_review' || session.status === 'failed') {
        navigation.replace('AriaReview', { sessionId })
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Processing failed'))
      setPhase('idle')
      Alert.alert('Aria', getApiErrorMessage(err, 'Could not process recording'))
    }
  }

  const statusLabel =
    phase === 'recording'
      ? 'Aria is listening…'
      : phase === 'paused'
        ? 'Paused'
        : phase === 'uploading'
          ? 'Uploading final audio…'
          : phase === 'processing'
            ? remoteStatus === 'generating'
              ? 'Aria drafting note…'
              : 'Finishing note…'
            : 'Ready'

  const liveTranscript = liveSegments.map((s) => s.text).join('\n\n')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.patient} numberOfLines={1}>{patientName}</Text>
        {visitType ? <Text style={styles.visitType}>{visitType}</Text> : null}
        <View style={styles.timerRow}>
          <View style={[styles.dot, phase === 'recording' && styles.dotLive]} />
          <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
          <Text style={styles.statusInline}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.transcriptCard}>
        <View style={styles.transcriptHeader}>
          <Text style={styles.transcriptTitle}>Live transcript</Text>
          <Text style={styles.transcriptMeta}>
            {segmentsSynced > 0
              ? `${segmentsSynced} segment${segmentsSynced === 1 ? '' : 's'}`
              : 'Waiting for first segment…'}
            {segmentsFailed > 0 ? ` · ${segmentsFailed} failed` : ''}
          </Text>
        </View>
        <ScrollView
          ref={transcriptScrollRef}
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          keyboardShouldPersistTaps="handled"
        >
          {liveTranscript ? (
            <Text style={styles.transcriptText}>{liveTranscript}</Text>
          ) : (
            <Text style={styles.transcriptPlaceholder}>
              Aria transcribes every ~35 seconds while you talk. Text will appear here as each segment finishes.
            </Text>
          )}
        </ScrollView>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {phase === 'uploading' || phase === 'processing' ? (
        <View style={styles.processingBar}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.processingText}>{statusLabel}</Text>
        </View>
      ) : (
        <View style={styles.controls}>
          {phase === 'recording' ? (
            <Pressable style={styles.secondary} onPress={() => void onPause()}>
              <Text style={styles.secondaryText}>Pause</Text>
            </Pressable>
          ) : null}
          {phase === 'paused' ? (
            <Pressable style={styles.secondary} onPress={() => void onResume()}>
              <Text style={styles.secondaryText}>Resume</Text>
            </Pressable>
          ) : null}
          {(phase === 'recording' || phase === 'paused') && (
            <Pressable style={styles.stop} onPress={() => void onStop()}>
              <Text style={styles.stopText}>Stop & generate</Text>
            </Pressable>
          )}
          {phase === 'idle' ? (
            <Pressable style={styles.stop} onPress={() => void begin()}>
              <Text style={styles.stopText}>Start ambient</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    gap: 4,
    marginBottom: spacing.md,
  },
  patient: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  visitType: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.borderStrong,
  },
  dotLive: {
    backgroundColor: colors.error,
  },
  timer: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statusInline: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  transcriptCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSubtle,
    overflow: 'hidden',
    minHeight: 220,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  transcriptTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  transcriptMeta: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: fontWeight.medium,
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  transcriptText: {
    fontSize: fontSize.base,
    lineHeight: 22,
    color: colors.text,
  },
  transcriptPlaceholder: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.textMuted,
  },
  error: {
    marginTop: spacing.sm,
    color: colors.error,
    textAlign: 'center',
  },
  processingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  processingText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  controls: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
    gap: spacing.sm,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  stop: {
    backgroundColor: colors.error,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  stopText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
})
