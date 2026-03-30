import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { forgotPassword } from '@/services/auth'
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/theme'
import type { AuthStackParamList } from '@/navigation/types'

type Nav   = NativeStackNavigationProp<AuthStackParamList, 'VerifyOTP'>
type Route = RouteProp<AuthStackParamList, 'VerifyOTP'>

const OTP_LENGTH = 6
const EXPIRE_SECONDS = 15 * 60 // 15 min

export function VerifyOTPScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { resetToken: initialToken, email } = route.params

  const [otp, setOtp]               = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [resetToken, setResetToken] = useState(initialToken)
  const [loading, setLoading]       = useState(false)
  const [resending, setResending]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [seconds, setSeconds]       = useState(EXPIRE_SECONDS)
  const inputs                      = useRef<(TextInput | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (seconds <= 0) return
    const t = setInterval(() => setSeconds(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [seconds])

  const timerLabel = seconds > 0
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    : 'Expired'

  const handleChange = (val: string, idx: number) => {
    // Handle paste of full OTP
    if (val.length === OTP_LENGTH) {
      const digits = val.replace(/\D/g, '').slice(0, OTP_LENGTH).split('')
      setOtp(digits)
      inputs.current[OTP_LENGTH - 1]?.focus()
      return
    }
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < OTP_LENGTH - 1) inputs.current[idx + 1]?.focus()
  }

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp]
      next[idx - 1] = ''
      setOtp(next)
      inputs.current[idx - 1]?.focus()
    }
  }

  const otpValue = otp.join('')
  const isComplete = otpValue.length === OTP_LENGTH

  const handleVerify = () => {
    if (!isComplete) return
    navigation.navigate('NewPassword', { resetToken, otp: otpValue })
  }

  const handleResend = async () => {
    setResending(true)
    setError(null)
    try {
      const res = await forgotPassword(email)
      setResetToken(res.resetToken)
      setOtp(Array(OTP_LENGTH).fill(''))
      setSeconds(EXPIRE_SECONDS)
      inputs.current[0]?.focus()
    } catch (err: any) {
      setError(err.message ?? 'Failed to resend code.')
    } finally {
      setResending(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="mail-unread-outline" size={28} color={colors.accent} />
          </View>

          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailBold}>{email}</Text>
          </Text>

          <View style={[styles.card, shadow.sm]}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* OTP boxes */}
            <View style={styles.otpRow}>
              {Array(OTP_LENGTH).fill(0).map((_, i) => (
                <TextInput
                  key={i}
                  ref={r => { inputs.current[i] = r }}
                  style={[styles.otpBox, otp[i] && styles.otpBoxFilled]}
                  value={otp[i]}
                  onChangeText={v => handleChange(v, i)}
                  onKeyPress={e => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  selectTextOnFocus
                  editable={!loading}
                  textAlign="center"
                />
              ))}
            </View>

            {/* Timer */}
            <View style={styles.timerRow}>
              <Ionicons
                name={seconds > 0 ? 'time-outline' : 'alert-circle-outline'}
                size={14}
                color={seconds > 60 ? colors.textMuted : seconds > 0 ? colors.warning : colors.error}
              />
              <Text style={[
                styles.timerText,
                seconds <= 60 && seconds > 0 && { color: colors.warning },
                seconds === 0 && { color: colors.error },
              ]}>
                {seconds > 0 ? `Code expires in ${timerLabel}` : 'Code expired'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, (!isComplete || loading || seconds === 0) && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={!isComplete || loading || seconds === 0}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={styles.btnText}>Verify code</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive it? </Text>
            <TouchableOpacity onPress={handleResend} disabled={resending} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {resending
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Text style={styles.resendLink}>Resend code</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  kav:  { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xxxl },
  backText: { fontSize: fontSize.base, color: colors.text },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.xl,
    backgroundColor: colors.accentLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title:     { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  subtitle:  { fontSize: fontSize.base, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xxl },
  emailBold: { fontWeight: fontWeight.semibold, color: colors.text },
  card: {
    backgroundColor: colors.bg, borderRadius: radius.xl,
    padding: spacing.xxl, gap: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorLight, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: '#FCA5A5',
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.error },
  otpRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  otpBox: {
    width: 46, height: 54,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: fontSize.xl, fontWeight: fontWeight.bold,
    color: colors.text, backgroundColor: colors.bg,
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center' },
  timerText: { fontSize: fontSize.sm, color: colors.textMuted },
  btn: {
    height: 48, backgroundColor: colors.accent,
    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  resendLink:  { fontSize: fontSize.sm, color: colors.accent, fontWeight: fontWeight.semibold },
})
