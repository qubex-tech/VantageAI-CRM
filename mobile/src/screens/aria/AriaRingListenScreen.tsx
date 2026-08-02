import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAriaSession } from '@/hooks/useAria'
import { discardAriaSession, processAriaSession } from '@/services/aria'
import { getApiErrorMessage } from '@/services/apiClient'
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme'
import type { AriaStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<AriaStackParamList, 'AriaRingListen'>
type Route = RouteProp<AriaStackParamList, 'AriaRingListen'>

export function AriaRingListenScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { sessionId, patientName } = route.params
  const [busy, setBusy] = useState<'process' | 'discard' | null>(null)

  const { data, refetch } = useAriaSession(sessionId, { poll: true, pollMs: 3000 })
  const session = data?.session
  const transcript = (session?.transcript || '').trim()
  const status = session?.status
  const chunkCount = session?.chunkCount ?? 0

  useEffect(() => {
    if (!status) return
    if (status === 'ready_for_review' || status === 'failed') {
      navigation.replace('AriaReview', { sessionId })
    }
  }, [status, navigation, sessionId])

  const onGenerate = async () => {
    if (chunkCount === 0 && !transcript) {
      Alert.alert('Aria', 'Dictate on your Index ring first, then generate the note.')
      return
    }
    setBusy('process')
    try {
      const result = await processAriaSession(sessionId)
      if (result.session.status === 'ready_for_review' || result.session.status === 'failed') {
        navigation.replace('AriaReview', { sessionId })
      } else {
        await refetch()
      }
    } catch (err) {
      Alert.alert('Aria', getApiErrorMessage(err, 'Could not generate note'))
    } finally {
      setBusy(null)
    }
  }

  const onDiscard = () => {
    Alert.alert('Discard session?', 'This clears the ring dictation draft.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          setBusy('discard')
          try {
            await discardAriaSession(sessionId)
            navigation.popToTop()
          } catch (err) {
            Alert.alert('Aria', getApiErrorMessage(err, 'Could not discard'))
          } finally {
            setBusy(null)
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.patient} numberOfLines={1}>
          {patientName}
        </Text>
        <Text style={styles.status}>Index ring session active</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How to dictate</Text>
        <Text style={styles.cardBody}>
          1. Wear your Pebble Index ring{'\n'}
          2. Double-click & hold the button{'\n'}
          3. Speak your note, then release{'\n'}
          4. Tap Generate note when finished
        </Text>
        <Text style={styles.cardHint}>
          This visit is bound for your provider webhook. Clips land here as Aria dictation.
        </Text>
      </View>

      <ScrollView style={styles.transcriptCard} contentContainerStyle={styles.transcriptContent}>
        <Text style={styles.transcriptTitle}>
          Captured transcript{chunkCount > 0 ? ` · ${chunkCount} clip${chunkCount === 1 ? '' : 's'}` : ''}
        </Text>
        <Text style={styles.transcriptBody}>
          {transcript || 'Waiting for Index ring dictation…'}
        </Text>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryBtn, busy && styles.disabled]}
          disabled={Boolean(busy)}
          onPress={() => void onGenerate()}
        >
          {busy === 'process' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Generate note</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, busy && styles.disabled]}
          disabled={Boolean(busy)}
          onPress={onDiscard}
        >
          {busy === 'discard' ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={styles.secondaryBtnText}>Discard</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  patient: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  status: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: fontWeight.medium,
  },
  card: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardBody: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 22,
  },
  cardHint: {
    marginTop: spacing.md,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  transcriptCard: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transcriptContent: { padding: spacing.lg },
  transcriptTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  transcriptBody: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 22,
  },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  secondaryBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.errorLight,
  },
  secondaryBtnText: {
    color: colors.error,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  disabled: { opacity: 0.6 },
})
