import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAriaSession } from '@/hooks/useAria'
import {
  discardActiveRecording,
  getElapsedMs,
  pauseAmbientRecording,
  resumeAmbientRecording,
  startAmbientRecording,
  stopAmbientRecording,
} from '@/lib/ariaRecorder'
import { stopAriaSession, uploadAriaChunk } from '@/services/aria'
import { getApiErrorMessage } from '@/services/apiClient'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { AriaStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<AriaStackParamList, 'AriaCapture'>
type Route = RouteProp<AriaStackParamList, 'AriaCapture'>

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
  const [error, setError] = useState<string | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data } = useAriaSession(sessionId, {
    poll: phase === 'processing' || phase === 'uploading',
  })
  const remoteStatus = data?.session.status

  useEffect(() => {
    void activateKeepAwakeAsync('aria-capture')
    void begin()
    return () => {
      deactivateKeepAwake('aria-capture')
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

  const begin = async () => {
    try {
      setError(null)
      await startAmbientRecording()
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
      const { uri, durationMs } = await stopAmbientRecording()
      await uploadAriaChunk({
        sessionId,
        uri,
        kind: 'ambient',
        durationMs,
      })
      setPhase('processing')
      await stopAriaSession(sessionId)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Upload failed'))
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
          ? 'Uploading audio…'
          : phase === 'processing'
            ? remoteStatus === 'transcribing'
              ? 'Transcribing…'
              : remoteStatus === 'generating'
                ? 'Aria drafting note…'
                : 'Processing…'
            : 'Ready'

  return (
    <View style={styles.container}>
      <Text style={styles.patient}>{patientName}</Text>
      {visitType ? <Text style={styles.visitType}>{visitType}</Text> : null}

      <View style={styles.orbWrap}>
        <View style={[styles.orb, phase === 'recording' && styles.orbLive]} />
        <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {phase === 'uploading' || phase === 'processing' ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  patient: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  visitType: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  orbWrap: {
    marginTop: spacing.xxxl * 2,
    alignItems: 'center',
    gap: spacing.md,
  },
  orb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.accentSurface,
  },
  orbLive: {
    backgroundColor: colors.accent,
  },
  timer: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  status: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  error: {
    marginTop: spacing.lg,
    color: colors.error,
    textAlign: 'center',
  },
  controls: {
    marginTop: 'auto',
    marginBottom: spacing.xxxl,
    width: '100%',
    gap: spacing.md,
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
