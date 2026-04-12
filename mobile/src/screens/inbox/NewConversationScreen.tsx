import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, useWindowDimensions, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/services/apiClient'
import { ENDPOINTS } from '@/constants/api'
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/theme'

interface Patient {
  id: string
  name: string
  phone: string | null
  email: string | null
}

type Channel = 'sms' | 'email'

function usePatientSearch(query: string) {
  return useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: () =>
      apiGet<{ patients: Patient[] }>('/api/mobile/patients', {
        search: query,
        limit: 15,
      }),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })
}

export function NewConversationScreen() {
  const navigation = useNavigation<any>()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const qc = useQueryClient()

  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState<Patient | null>(null)
  const [channel, setChannel]         = useState<Channel>('sms')
  const [subject, setSubject]         = useState('')
  const [body, setBody]               = useState('')
  const [sent, setSent]               = useState(false)
  const bodyRef = useRef<TextInput>(null)

  // Success animation values
  const circleScale  = useRef(new Animated.Value(0)).current
  const checkOpacity = useRef(new Animated.Value(0)).current
  const textOpacity  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!sent) return
    Animated.sequence([
      Animated.spring(circleScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(textOpacity,  { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start()
    const timer = setTimeout(() => {
      navigation.popToTop()
    }, 1800)
    return () => clearTimeout(timer)
  }, [sent])

  const { data, isFetching } = usePatientSearch(search)
  const patients = selected ? [] : (data?.patients ?? [])

  const sendMutation = useMutation({
    mutationFn: (payload: any) =>
      apiPost<{ data: { conversationId: string } }>(ENDPOINTS.conversations, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['unreadCount'] })
      setSent(true)
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error ?? err?.message ?? 'Failed to send message'
      Alert.alert('Could not send', msg)
    },
  })

  const handleSelectPatient = useCallback((p: Patient) => {
    setSelected(p)
    setSearch(p.name)
    // Default channel based on what patient has
    if (!p.phone && p.email) setChannel('email')
    else if (!p.email && p.phone) setChannel('sms')
    setTimeout(() => bodyRef.current?.focus(), 150)
  }, [])

  const handleClearPatient = useCallback(() => {
    setSelected(null)
    setSearch('')
    setBody('')
    setSubject('')
  }, [])

  const canSend = Boolean(
    selected &&
    body.trim() &&
    !sendMutation.isPending &&
    (channel === 'sms' ? selected.phone : selected.email)
  )

  const handleSend = useCallback(() => {
    if (!selected || !canSend) return
    sendMutation.mutate({
      patientId: selected.id,
      channel,
      body: body.trim(),
      subject: channel === 'email' ? (subject.trim() || 'Message from your care team') : undefined,
    })
  }, [selected, canSend, channel, body, subject, sendMutation])

  const missingContact =
    selected &&
    ((channel === 'sms' && !selected.phone) ||
      (channel === 'email' && !selected.email))

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.headerBtnText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <TouchableOpacity
          onPress={handleSend}
          style={[styles.headerBtn, styles.headerBtnRight]}
          disabled={!canSend}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={[styles.headerBtnText, styles.headerSendText, !canSend && styles.headerSendDisabled]}>
              Send
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.form, isTablet && styles.formTablet]}>

          {/* To: row */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>To</Text>
            <View style={styles.rowInputWrap}>
              <TextInput
                style={styles.rowInput}
                value={search}
                onChangeText={(t) => {
                  setSearch(t)
                  if (selected) setSelected(null)
                }}
                placeholder="Search patient…"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {selected && (
                <TouchableOpacity onPress={handleClearPatient} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              {isFetching && !selected && (
                <ActivityIndicator size="small" color={colors.accent} />
              )}
            </View>
          </View>
          <View style={styles.rowDivider} />

          {/* Patient suggestions */}
          {patients.length > 0 && (
            <View style={styles.suggestions}>
              {patients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectPatient(p)}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionAvatar}>
                    <Text style={styles.suggestionAvatarText}>
                      {p.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionName}>{p.name}</Text>
                    <Text style={styles.suggestionSub} numberOfLines={1}>
                      {[p.phone, p.email].filter(Boolean).join(' · ') || 'No contact info'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Via: channel toggle */}
          {selected && (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Via</Text>
                <View style={styles.channelToggle}>
                  <TouchableOpacity
                    style={[styles.channelBtn, channel === 'sms' && styles.channelBtnActive]}
                    onPress={() => setChannel('sms')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="phone-portrait-outline"
                      size={14}
                      color={channel === 'sms' ? colors.white : colors.textSecondary}
                    />
                    <Text style={[styles.channelBtnText, channel === 'sms' && styles.channelBtnTextActive]}>
                      SMS
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.channelBtn, channel === 'email' && styles.channelBtnActive]}
                    onPress={() => setChannel('email')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={14}
                      color={channel === 'email' ? colors.white : colors.textSecondary}
                    />
                    <Text style={[styles.channelBtnText, channel === 'email' && styles.channelBtnTextActive]}>
                      Email
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.rowDivider} />
            </>
          )}

          {/* Subject: email only */}
          {selected && channel === 'email' && (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Subject</Text>
                <TextInput
                  style={styles.rowInput}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Message from your care team"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                  onSubmitEditing={() => bodyRef.current?.focus()}
                />
              </View>
              <View style={styles.rowDivider} />
            </>
          )}

          {/* Missing contact warning */}
          {missingContact && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning-outline" size={15} color={colors.warning} />
              <Text style={styles.warningText}>
                {channel === 'sms'
                  ? `${selected!.name} has no phone number on file.`
                  : `${selected!.name} has no email address on file.`}
              </Text>
            </View>
          )}

          {/* Message body */}
          {selected && (
            <TextInput
              ref={bodyRef}
              style={styles.bodyInput}
              value={body}
              onChangeText={setBody}
              placeholder={
                channel === 'sms'
                  ? 'Type your SMS message…'
                  : 'Type your email message…'
              }
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={channel === 'sms' ? 1600 : 10000}
              textAlignVertical="top"
            />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Success overlay */}
      {sent && (
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: circleScale }] }]}>
            <Animated.View style={{ opacity: checkOpacity }}>
              <Ionicons name="checkmark" size={52} color={colors.white} />
            </Animated.View>
          </Animated.View>
          <Animated.Text style={[styles.successTitle, { opacity: textOpacity }]}>
            Message Sent!
          </Animated.Text>
          <Animated.Text style={[styles.successSub, { opacity: textOpacity }]}>
            {selected
              ? `${selected.name} will receive your ${channel === 'sms' ? 'SMS' : 'email'} shortly.`
              : 'Your message has been sent.'}
          </Animated.Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  successTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  successSub: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerTablet: { paddingHorizontal: spacing.xxl },
  headerTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  headerBtn: { minWidth: 60 },
  headerBtnRight: { alignItems: 'flex-end' },
  headerBtnText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  headerSendText: {
    color: colors.accent,
    fontWeight: fontWeight.semibold,
  },
  headerSendDisabled: { opacity: 0.35 },

  divider: { height: 1, backgroundColor: colors.border },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 56 },

  form: { flex: 1 },
  formTablet: { maxWidth: 720, alignSelf: 'center', width: '100%' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 52,
  },
  rowLabel: {
    width: 48,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  rowInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
  },
  clearBtn: { padding: spacing.xs },

  suggestions: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  suggestionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionAvatarText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
  },
  suggestionInfo: { flex: 1 },
  suggestionName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  suggestionSub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },

  channelToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  channelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  channelBtnActive: {
    backgroundColor: colors.accent,
  },
  channelBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  channelBtnTextActive: {
    color: colors.white,
  },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningLight ?? '#FFF8E1',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning ?? '#F59E0B',
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.warning ?? '#B45309',
  },

  bodyInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    lineHeight: 22,
  },
})
