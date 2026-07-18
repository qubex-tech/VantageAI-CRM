import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAriaSession, useInvalidateAria } from '@/hooks/useAria'
import { discardAriaSession, patchAriaNote, signAriaSession, stopAriaSession, uploadAriaChunk } from '@/services/aria'
import {
  ensureMicPermission,
  startAmbientRecording,
  stopAmbientRecording,
} from '@/lib/ariaRecorder'
import { getApiErrorMessage } from '@/services/apiClient'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { AriaStackParamList } from '@/navigation/types'
import type { AriaSoapNote } from '@/types'

type Nav = NativeStackNavigationProp<AriaStackParamList, 'AriaReview'>
type Route = RouteProp<AriaStackParamList, 'AriaReview'>

const SECTIONS: Array<{ key: keyof AriaSoapNote; label: string }> = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective', label: 'Objective' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Plan' },
  { key: 'addendum', label: 'Addendum' },
]

export function AriaReviewScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { sessionId } = route.params
  const invalidate = useInvalidateAria()

  const { data, isLoading, refetch } = useAriaSession(sessionId)
  const session = data?.session

  const [soap, setSoap] = useState<AriaSoapNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    addendum: '',
  })
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [dictating, setDictating] = useState(false)

  useEffect(() => {
    if (session?.soap) setSoap(session.soap)
  }, [session?.soap])

  const updateField = (key: keyof AriaSoapNote, value: string) => {
    setSoap((prev) => ({ ...prev, [key]: value }))
  }

  const onSave = async () => {
    setSaving(true)
    try {
      await patchAriaNote(sessionId, soap)
      await refetch()
      invalidate()
    } catch (err) {
      Alert.alert('Aria', getApiErrorMessage(err, 'Could not save draft'))
    } finally {
      setSaving(false)
    }
  }

  const onSign = () => {
    Alert.alert(
      'Sign note',
      'I have reviewed this note. Signing will save it in Vantage and create a draft note in the EHR.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign & send',
          style: 'default',
          onPress: () => void doSign(),
        },
      ]
    )
  }

  const doSign = async () => {
    setSigning(true)
    try {
      await patchAriaNote(sessionId, soap)
      await signAriaSession(sessionId)
      invalidate()
      navigation.replace('AriaSigned', { sessionId })
    } catch (err) {
      Alert.alert('Aria', getApiErrorMessage(err, 'Could not sign note'))
    } finally {
      setSigning(false)
    }
  }

  const onDiscard = () => {
    Alert.alert('Discard draft?', 'Audio and draft note will be discarded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          try {
            await discardAriaSession(sessionId)
            invalidate()
            navigation.popToTop()
          } catch (err) {
            Alert.alert('Aria', getApiErrorMessage(err, 'Could not discard'))
          }
        },
      },
    ])
  }

  const onDictation = async () => {
    try {
      const ok = await ensureMicPermission()
      if (!ok) {
        Alert.alert('Aria', 'Microphone permission is required')
        return
      }
      setDictating(true)
      await startAmbientRecording()
      Alert.alert('Dictation', 'Aria is recording your addendum. Tap Stop when finished.', [
        {
          text: 'Stop',
          onPress: async () => {
            try {
              const { uri, durationMs } = await stopAmbientRecording()
              await uploadAriaChunk({
                sessionId,
                uri,
                kind: 'dictation',
                durationMs,
              })
              await stopAriaSession(sessionId)
              await refetch()
              Alert.alert('Aria', 'Regenerating note with your dictation…')
            } catch (err) {
              Alert.alert('Aria', getApiErrorMessage(err, 'Dictation failed'))
            } finally {
              setDictating(false)
            }
          },
        },
      ])
    } catch (err) {
      setDictating(false)
      Alert.alert('Aria', getApiErrorMessage(err, 'Could not start dictation'))
    }
  }

  if (isLoading || !session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.banner}>Drafted by Aria — review required</Text>
        <Text style={styles.patient}>{session.patient?.name || 'Patient'}</Text>
        {session.error ? <Text style={styles.error}>{session.error}</Text> : null}

        {SECTIONS.map(({ key, label }) => (
          <View key={key} style={styles.section}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              multiline
              textAlignVertical="top"
              value={soap[key] || ''}
              onChangeText={(v) => updateField(key, v)}
              placeholder={`${label}…`}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.ghost} onPress={onDiscard}>
          <Text style={styles.ghostText}>Discard</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void onDictation()} disabled={dictating}>
          <Text style={styles.secondaryText}>{dictating ? 'Listening…' : 'Dictation'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void onSave()} disabled={saving}>
          <Text style={styles.secondaryText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={onSign} disabled={signing}>
          {signing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>Sign</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  banner: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentLight,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
  },
  patient: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  error: { color: colors.error, fontSize: fontSize.sm },
  section: { gap: spacing.xs },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
    backgroundColor: colors.bgSubtle,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  ghost: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  ghostText: { color: colors.error, fontWeight: fontWeight.semibold },
  secondary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryText: { color: colors.text, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  primary: {
    marginLeft: 'auto',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    minWidth: 88,
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontWeight: fontWeight.semibold },
})
