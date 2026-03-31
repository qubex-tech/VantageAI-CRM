import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '@/store/authStore'
import { verifyEmailOtp, sendEmailOtp } from '@/services/auth'
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/theme'
import type { AuthStackParamList } from '@/navigation/types'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

type RouteT = RouteProp<AuthStackParamList, 'VerifyEmailCode'>

const OTP_LENGTH = 6

export function VerifyEmailCodeScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteT>()
  const { loginToken, email } = route.params

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [currentLoginToken, setCurrentLoginToken] = useState(loginToken)

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null))
  const { restoreSession } = useAuthStore()

  // Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const code = digits.join('')

  const handleChange = (text: string, index: number) => {
    setError('')
    // Handle paste
    const clean = text.replace(/\D/g, '')
    if (clean.length > 1) {
      const next = [...digits]
      for (let i = 0; i < OTP_LENGTH && i < clean.length; i++) {
        next[i] = clean[i]
      }
      setDigits(next)
      const focusIdx = Math.min(clean.length, OTP_LENGTH - 1)
      inputRefs.current[focusIdx]?.focus()
      return
    }
    const next = [...digits]
    next[index] = clean
    setDigits(next)
    if (clean && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    if (code.length !== OTP_LENGTH) return
    setLoading(true)
    setError('')
    try {
      const result = await verifyEmailOtp(currentLoginToken, code)
      // Persist token + user then restore session state
      await SecureStore.setItemAsync(TOKEN_KEY, result.token)
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user))
      await restoreSession()
    } catch (err: any) {
      setError(err.message ?? 'Invalid code. Please try again.')
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      const result = await sendEmailOtp(email)
      setCurrentLoginToken(result.loginToken)
      setResendCooldown(60)
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      setError(err.message ?? 'Failed to resend. Try again.')
    } finally {
      setResending(false)
    }
  }

  // Auto-submit when all digits filled
  useEffect(() => {
    if (code.length === OTP_LENGTH && !loading) handleVerify()
  }, [code])

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>V</Text>
            </View>
            <Text style={styles.brandName}>VantageAI</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, shadow.md]}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-open-outline" size={28} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>Check your email</Text>
            <Text style={styles.cardSub}>
              We sent a 6-digit sign-in code to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            {/* OTP boxes */}
            <View style={styles.otpRow}>
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={r => { inputRefs.current[i] = r }}
                  style={[styles.otpBox, d ? styles.otpBoxFilled : null, error ? styles.otpBoxError : null]}
                  value={d}
                  onChangeText={t => handleChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                  editable={!loading}
                  autoFocus={i === 0}
                />
              ))}
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Verify button */}
            <TouchableOpacity
              style={[styles.btn, (code.length < OTP_LENGTH || loading) && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={code.length < OTP_LENGTH || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={styles.btnText}>Sign in</Text>}
            </TouchableOpacity>

            {/* Resend */}
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive it? </Text>
              {resendCooldown > 0 ? (
                <Text style={styles.resendCooldown}>Resend in {resendCooldown}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={resending}>
                  <Text style={styles.resendLink}>
                    {resending ? 'Sending…' : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  back: {
    alignSelf: 'flex-start',
    padding: spacing.sm,
    marginBottom: -spacing.md,
  },
  brand: { alignItems: 'center', gap: spacing.sm },
  logoBox: {
    width: 56, height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 26, fontWeight: fontWeight.bold, color: colors.white },
  brandName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },

  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64, height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  cardSub: {
    fontSize: fontSize.sm, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
  emailHighlight: { fontWeight: fontWeight.semibold, color: colors.text },

  otpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  otpBox: {
    width: 44, height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    textAlign: 'center',
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  otpBoxFilled: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  otpBoxError: { borderColor: colors.error, backgroundColor: colors.errorLight },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: '#FCA5A5',
    alignSelf: 'stretch',
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.error },

  btn: {
    height: 48, width: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },

  resendRow: { flexDirection: 'row', alignItems: 'center' },
  resendLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  resendCooldown: { fontSize: fontSize.sm, color: colors.textMuted },
  resendLink: { fontSize: fontSize.sm, color: colors.accent, fontWeight: fontWeight.medium },
})
