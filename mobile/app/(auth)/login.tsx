import React, { useState } from 'react'
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Colors } from '@/constants/colors'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim().toLowerCase(), password)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Invalid email or password. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Branding */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: Colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Ionicons name="pulse" size={36} color={Colors.white} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.text }}>VantageAI</Text>
            <Text style={{ fontSize: 15, color: Colors.textSecondary, marginTop: 4 }}>
              Practice Management
            </Text>
          </View>

          {/* Form */}
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 16,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.text }}>Sign in</Text>

            {error && (
              <View
                style={{
                  backgroundColor: Colors.dangerBg,
                  borderRadius: 8,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={{ fontSize: 13, color: Colors.danger, flex: 1 }}>{error}</Text>
              </View>
            )}

            <Input
              label="Email"
              placeholder="you@practice.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              leftIcon={<Ionicons name="mail-outline" size={16} color={Colors.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
              leftIcon={<Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} />}
            />

            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              style={{ alignSelf: 'flex-end', marginTop: -8 }}
            >
              <Text style={{ fontSize: 13, color: Colors.primary }}>
                {showPassword ? 'Hide password' : 'Show password'}
              </Text>
            </TouchableOpacity>

            <Button
              title="Sign in"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              style={{ marginTop: 4 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
