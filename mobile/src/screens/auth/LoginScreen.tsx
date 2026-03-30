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
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/theme'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading, error, clearError } = useAuthStore()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const navigation = useNavigation()

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    clearError()
    try { await login(email.trim().toLowerCase(), password) } catch {}
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView
          contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand mark */}
          <View style={styles.brand}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>V</Text>
            </View>
            <Text style={styles.brandName}>VantageAI</Text>
            <Text style={styles.brandSub}>Medical CRM — Staff Portal</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, isTablet && styles.cardTablet, shadow.md]}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}>Sign in to continue</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={[styles.inputRow, !email && styles.inputRowEmpty]}>
                <Ionicons name="mail-outline" size={17} color={colors.textMuted} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => { clearError(); setEmail(v) }}
                  placeholder="you@practice.com"
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} style={styles.icon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={(v) => { clearError(); setPassword(v) }}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textDisabled}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading || !email || !password}
              activeOpacity={0.85}
            >
              {isLoading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={styles.btnText}>Sign in</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => (navigation as any).navigate('ForgotPassword')}
              style={styles.forgotBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  scrollTablet: { paddingHorizontal: spacing.xxxl * 2 },

  brand: { alignItems: 'center', gap: spacing.sm },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 26, fontWeight: fontWeight.bold, color: colors.white },
  brandName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  brandSub:  { fontSize: fontSize.sm, color: colors.textMuted },

  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTablet: { maxWidth: 460 },
  cardTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  cardSub:   { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: -spacing.sm },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.error },

  field: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  inputRowEmpty: { borderColor: colors.border },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    height: '100%',
  },

  btn: {
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },

  forgotBtn: { alignItems: 'center', marginTop: spacing.xs },
  forgotText: { fontSize: fontSize.sm, color: colors.accent, fontWeight: fontWeight.medium },

  footer: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
})
