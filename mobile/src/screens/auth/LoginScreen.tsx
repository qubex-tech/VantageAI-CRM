import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '@/store/authStore'
import { sendEmailOtp } from '@/services/auth'
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/theme'

type AuthMethod = 'password' | 'emailLink'

export function LoginScreen() {
  const [method, setMethod] = useState<AuthMethod>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')

  const { login, isLoading, error, clearError } = useAuthStore()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const navigation = useNavigation<any>()

  const switchMethod = (m: AuthMethod) => {
    setMethod(m)
    clearError()
    setOtpError('')
    setPassword('')
  }

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password) return
    clearError()
    try { await login(email.trim().toLowerCase(), password) } catch {}
  }

  const handleSendEmailCode = async () => {
    if (!email.trim()) return
    setOtpError('')
    setOtpLoading(true)
    try {
      const result = await sendEmailOtp(email.trim().toLowerCase())
      navigation.navigate('VerifyEmailCode', {
        loginToken: result.loginToken,
        email: email.trim().toLowerCase(),
      })
    } catch (err: any) {
      setOtpError(err.message ?? 'Failed to send code. Try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  const isPasswordDisabled = isLoading || !email.trim() || !password
  const isEmailLinkDisabled = otpLoading || !email.trim()
  const displayError = method === 'password' ? error : otpError

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView
          contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>V</Text>
            </View>
            <Text style={styles.brandName}>VantageAI</Text>
            <Text style={styles.brandSub}>Medical CRM — Staff Portal</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, isTablet && styles.cardTablet, shadow.md]}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardSub}>
              {method === 'password'
                ? 'Sign in with your email and password'
                : 'Receive a one-time code in your email'}
            </Text>

            {/* Toggle */}
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, method === 'password' && styles.toggleBtnActive]}
                onPress={() => switchMethod('password')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, method === 'password' && styles.toggleTextActive]}>
                  Password
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, method === 'emailLink' && styles.toggleBtnActive]}
                onPress={() => switchMethod('emailLink')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, method === 'emailLink' && styles.toggleTextActive]}>
                  Email Code
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error */}
            {displayError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            ) : null}

            {/* Email field */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={17} color={colors.textMuted} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={v => { clearError(); setOtpError(''); setEmail(v) }}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType={method === 'password' ? 'next' : 'send'}
                  onSubmitEditing={method === 'emailLink' ? handleSendEmailCode : undefined}
                  editable={!isLoading && !otpLoading}
                />
              </View>
            </View>

            {/* Password field (password mode only) */}
            {method === 'password' && (
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ForgotPassword')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={v => { clearError(); setPassword(v) }}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textDisabled}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handlePasswordLogin}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* CTA button */}
            {method === 'password' ? (
              <TouchableOpacity
                style={[styles.btn, isPasswordDisabled && styles.btnDisabled]}
                onPress={handlePasswordLogin}
                disabled={isPasswordDisabled}
                activeOpacity={0.85}
              >
                {isLoading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.btnText}>Sign in with password</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btn, isEmailLinkDisabled && styles.btnDisabled]}
                onPress={handleSendEmailCode}
                disabled={isEmailLinkDisabled}
                activeOpacity={0.85}
              >
                {otpLoading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.btnText}>Send sign-in code</Text>}
              </TouchableOpacity>
            )}

            <Text style={styles.hint}>
              {method === 'password'
                ? 'Password is the primary sign-in method. Use Email Code if needed.'
                : 'Email Code is available as a fallback sign-in method.'}
            </Text>
          </View>

          <Text style={styles.footer}>Secure · HIPAA-compliant</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  kav:  { flex: 1 },
  scroll: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, gap: spacing.xxl,
  },
  scrollTablet: { paddingHorizontal: spacing.xxxl * 2 },

  brand: { alignItems: 'center', gap: spacing.sm },
  logoBox: {
    width: 56, height: 56, borderRadius: radius.xl,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 26, fontWeight: fontWeight.bold, color: colors.white },
  brandName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  brandSub:  { fontSize: fontSize.sm, color: colors.textMuted },

  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: colors.bg, borderRadius: radius.xl,
    padding: spacing.xxl, gap: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTablet: { maxWidth: 460 },
  cardTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  cardSub:   { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: -spacing.sm },

  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 8, borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.bg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  toggleText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  toggleTextActive: { color: colors.text, fontWeight: fontWeight.semibold },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorLight, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: '#FCA5A5',
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.error },

  field: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  forgotText: { fontSize: fontSize.sm, color: colors.accent, fontWeight: fontWeight.medium },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.bg,
    paddingHorizontal: spacing.md, height: 46,
  },
  icon: { marginRight: spacing.sm },
  input: { flex: 1, fontSize: fontSize.base, color: colors.text, height: '100%' },

  btn: {
    height: 48, backgroundColor: colors.accent,
    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },

  hint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  footer: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
})
