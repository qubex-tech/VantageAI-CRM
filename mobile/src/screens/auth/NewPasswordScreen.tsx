import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { resetPassword } from '@/services/auth'
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/theme'
import type { AuthStackParamList } from '@/navigation/types'

type Nav   = NativeStackNavigationProp<AuthStackParamList, 'NewPassword'>
type Route = RouteProp<AuthStackParamList, 'NewPassword'>

export function NewPasswordScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { resetToken, otp } = route.params

  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [showConf, setShowConf]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)

  const passwordsMatch  = password === confirm
  const passwordValid   = password.length >= 8
  const canSubmit       = passwordValid && passwordsMatch && !loading && !!confirm

  const handleReset = async () => {
    if (!canSubmit) return
    if (!passwordsMatch) { setError('Passwords do not match.'); return }
    if (!passwordValid)  { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError(null)
    try {
      await resetPassword(resetToken, otp, password)
      setSuccess(true)
      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
      }, 2000)
    } catch (err: any) {
      setError(err.message ?? 'Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Password updated!</Text>
          <Text style={styles.successSub}>Taking you back to sign in…</Text>
        </View>
      </SafeAreaView>
    )
  }

  const strengthColor = !password ? colors.border
    : password.length < 8 ? colors.error
    : password.length < 12 ? colors.warning
    : colors.success

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={28} color={colors.accent} />
          </View>

          <Text style={styles.title}>Create new password</Text>
          <Text style={styles.subtitle}>Your new password must be at least 8 characters.</Text>

          <View style={[styles.card, shadow.sm]}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* New password */}
            <View style={styles.field}>
              <Text style={styles.label}>New password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} style={styles.icon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.textDisabled}
                  secureTextEntry={!showPwd}
                  editable={!loading}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {/* Strength bar */}
              {password.length > 0 && (
                <View style={styles.strengthBar}>
                  <View style={[styles.strengthFill, { backgroundColor: strengthColor, width: `${Math.min((password.length / 16) * 100, 100)}%` }]} />
                </View>
              )}
            </View>

            {/* Confirm password */}
            <View style={styles.field}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={[styles.inputRow, confirm && !passwordsMatch && styles.inputRowError]}>
                <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} style={styles.icon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textDisabled}
                  secureTextEntry={!showConf}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowConf(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showConf ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {confirm && !passwordsMatch && (
                <Text style={styles.matchError}>Passwords don't match</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.btn, !canSubmit && styles.btnDisabled]}
              onPress={handleReset}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={styles.btnText}>Update password</Text>
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
  title:    { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.base, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xxl },
  card: {
    backgroundColor: colors.bg, borderRadius: radius.xl,
    padding: spacing.xxl, gap: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorLight, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: '#FCA5A5',
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.error },
  field: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.bg,
    paddingHorizontal: spacing.md, height: 46,
  },
  inputRowError: { borderColor: colors.error },
  icon:  { marginRight: spacing.sm },
  input: { flex: 1, fontSize: fontSize.base, color: colors.text, height: '100%' },
  strengthBar: { height: 3, backgroundColor: colors.bgMuted, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  strengthFill: { height: '100%', borderRadius: 2 },
  matchError: { fontSize: fontSize.xs, color: colors.error, marginTop: 2 },
  btn: {
    height: 48, backgroundColor: colors.accent,
    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  successContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl,
  },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.successLight,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  successSub:   { fontSize: fontSize.base, color: colors.textMuted },
})
