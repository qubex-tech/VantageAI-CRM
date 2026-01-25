'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Patient Portal Auth Page
 * OTP-based login (email or SMS)
 */
export default function PortalAuthPage() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inviteError = searchParams.get('error')

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/portal/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email || undefined, 
          phone: phone || undefined,
          fullName: fullName.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send OTP')
      }

      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/portal/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          email: email || undefined,
          phone: phone || undefined,
          fullName: fullName.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Invalid code')
      }

      // Successfully verified - redirect to portal home
      // Use window.location.replace to avoid back button issues
      window.location.replace('/portal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Patient Portal</CardTitle>
          <CardDescription>
            {step === 'request'
              ? 'Enter your full name and email or phone number to receive a login code'
              : 'Enter the code sent to your email or phone'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inviteError && step === 'request' && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {inviteError === 'invite_required' && (
                <p>You need a secure invite link from your practice to access this portal.</p>
              )}
              {inviteError === 'invalid_invite' && (
                <p>Your invite link is invalid or expired. Please request a new invite from your practice.</p>
              )}
            </div>
          )}
          {step === 'request' ? (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (e.target.value) setPhone('') // Clear phone if email is entered
                  }}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 text-center">OR</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (e.target.value) setEmail('') // Clear email if phone is entered
                  }}
                  placeholder="+1234567890"
                />
              </div>
              <p className="text-xs text-gray-500">
                For security, portal access requires a secure invite link from your practice.
              </p>
              <p className="text-xs text-gray-500">
                Please provide your full name and either email or phone number. This helps us identify you if you share contact information with family members.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || !fullName.trim() || (!email && !phone)}>
                {loading ? 'Sending...' : 'Send Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Enter Code</Label>
                <Input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('request')}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading || code.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
