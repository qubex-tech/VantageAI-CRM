import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { GlassesDisplaySession } from '@/lib/glassesSession'
import {
  askGlasses,
  fetchGlassesContext,
  glassesErrorMessage,
  isAddendumRequired,
} from '@/services/glasses'
import {
  getGlassesStatus,
  startNativeGlassesSession,
  stopNativeGlassesSession,
  syncGlassesFrame,
} from '../../../modules/meta-glasses/src'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { PatientsStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<PatientsStackParamList, 'GlassesSession'>
type Route = RouteProp<PatientsStackParamList, 'GlassesSession'>

export function GlassesSessionScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { width } = useWindowDimensions()
  const frameSize = Math.min(width - spacing.lg * 2, 360)
  const [demo, setDemo] = useState(Boolean(route.params.demo))
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [linked] = useState(() => getGlassesStatus().linked)
  const sessionRef = useRef<GlassesDisplaySession | null>(null)
  if (!sessionRef.current) sessionRef.current = new GlassesDisplaySession()
  const session = sessionRef.current
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot)

  const patientKey = demo ? 'demo' : route.params.patientId
  const query = useQuery({
    queryKey: ['glasses-context', patientKey],
    queryFn: () => fetchGlassesContext(patientKey),
    retry: false,
  })

  useLayoutEffect(() => {
    navigation.setOptions({
      title: demo ? 'Demo glance' : route.params.patientName || 'Glasses',
    })
  }, [navigation, demo, route.params.patientName])

  useEffect(() => {
    if (!query.data) return
    const cards = query.data.cards
    session.start(cards)
    startNativeGlassesSession(
      cards.map((card) => ({ cardId: card.id, title: card.title, lines: card.lines }))
    )
    return () => {
      session.stop()
      stopNativeGlassesSession()
    }
  }, [query.data, session])

  useEffect(() => {
    syncGlassesFrame(
      snap.frame
        ? { cardId: snap.frame.cardId, title: snap.frame.title, lines: snap.frame.lines }
        : null,
      snap.state
    )
  }, [snap])

  const blocked = isAddendumRequired(query.error)
  const lines = snap.asleep ? ['Display asleep', 'Swipe or double-tap to wake', ''] : snap.frame?.lines ?? ['', '', '']

  const submitAsk = async () => {
    const action = session.select()
    if (action !== 'ask') return
    const text = question.trim()
    if (!text) {
      setAskError('Ask a short chart question.')
      return
    }
    setAsking(true)
    setAskError(null)
    try {
      const result = await askGlasses(patientKey, text)
      session.showAnswer(result.answer)
      setQuestion('')
    } catch (err) {
      setAskError(glassesErrorMessage(err, 'Could not answer from the chart'))
    } finally {
      setAsking(false)
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.transport}>
        {linked
          ? 'This frame is sent to the Ray-Ban Display.'
          : 'Phone preview. The glasses SDK is not linked, so this is the 600×600 frame the display would show.'}
      </Text>
      {query.data?.notice ? <Text style={styles.notice}>{query.data.notice}</Text> : null}

      {query.isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : null}

      {blocked ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Real chart stays on the phone</Text>
          <Text style={styles.blockBody}>
            Meta has not signed a healthcare addendum. This patient’s chart will not be sent to the glasses or to Muse.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => setDemo(true)}>
            <Text style={styles.primaryBtnText}>Preview fictional chart</Text>
          </Pressable>
        </View>
      ) : null}

      {query.error && !blocked ? (
        <View style={styles.block}>
          <Text style={styles.errorText}>{glassesErrorMessage(query.error, 'Could not load the glance card')}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => void query.refetch()}>
            <Text style={styles.secondaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {snap.state === 'started' ? (
        <>
          <View style={[styles.frame, { width: frameSize, height: frameSize }]}>
            <Text style={styles.frameTitle}>{snap.asleep ? 'Asleep' : snap.frame?.title}</Text>
            {lines.map((line, index) => (
              <Text
                key={`${snap.frame?.cardId}-${index}`}
                style={[
                  index === 0 ? styles.linePrimary : styles.lineBody,
                  snap.dimmed && !snap.asleep ? styles.dimmed : null,
                ]}
              >
                {line || ' '}
              </Text>
            ))}
            <Text style={styles.askHint}>Double-tap to ask</Text>
            <View style={styles.dots}>
              {Array.from({ length: snap.cardCount }).map((_, index) => (
                <View key={index} style={[styles.dot, index === snap.index ? styles.dotOn : null]} />
              ))}
            </View>
          </View>

          <View style={styles.controls}>
            <Pressable style={styles.control} onPress={() => session.nav('left')}>
              <Text style={styles.controlText}>Previous</Text>
            </Pressable>
            <Pressable style={styles.control} onPress={() => session.nav('right')}>
              <Text style={styles.controlText}>Next</Text>
            </Pressable>
            {snap.asleep ? (
              <Pressable style={styles.control} onPress={() => session.select()}>
                <Text style={styles.controlText}>Wake</Text>
              </Pressable>
            ) : null}
          </View>

          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask the loaded chart"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!asking}
            onSubmitEditing={() => void submitAsk()}
            returnKeyType="send"
          />
          {askError ? <Text style={styles.errorText}>{askError}</Text> : null}
          <Pressable
            style={[styles.primaryBtn, asking && styles.btnDisabled]}
            disabled={asking}
            onPress={() => void submitAsk()}
          >
            {asking ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Ask</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              session.stop()
              stopNativeGlassesSession()
              navigation.goBack()
            }}
          >
            <Text style={styles.secondaryBtnText}>End session</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  transport: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  notice: {
    fontSize: fontSize.xs,
    color: colors.warning,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  frame: {
    alignSelf: 'center',
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  frameTitle: {
    color: '#9CA3AF',
    fontSize: fontSize.xs,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  linePrimary: {
    color: colors.white,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  lineBody: {
    color: colors.white,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  dimmed: { opacity: 0.35 },
  askHint: {
    color: '#9CA3AF',
    fontSize: fontSize.xs,
    marginTop: spacing.md,
  },
  dots: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#374151' },
  dotOn: { backgroundColor: colors.white },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  control: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  controlText: { fontSize: fontSize.xs, color: colors.text, fontWeight: fontWeight.semibold },
  input: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.text,
  },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  secondaryBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.accent, fontWeight: fontWeight.semibold },
  btnDisabled: { opacity: 0.5 },
  block: { marginTop: spacing.lg },
  blockTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  blockBody: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  errorText: { color: colors.error, marginTop: spacing.sm, fontSize: fontSize.sm },
})
