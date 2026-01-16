'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TwilioSettingsProps {
  initialIntegration: any
  practiceId?: string // Optional practiceId for Vantage Admins
}

export function TwilioSettings({ initialIntegration, practiceId }: TwilioSettingsProps) {
  const apiUrl = (path: string) => {
    if (practiceId) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}practiceId=${practiceId}`
    }
    return path
  }

  const [accountSid, setAccountSid] = useState(initialIntegration?.accountSid || '')
  const [authToken, setAuthToken] = useState(initialIntegration?.authToken || '')
  const [messagingServiceSid, setMessagingServiceSid] = useState(initialIntegration?.messagingServiceSid || '')
  const [fromNumber, setFromNumber] = useState(initialIntegration?.fromNumber || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(apiUrl('/api/settings/twilio'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid,
          authToken,
          messagingServiceSid: messagingServiceSid || undefined,
          fromNumber: fromNumber || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      setSuccess('Twilio integration saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setError('')
    setSuccess('')
    setTestingConnection(true)

    try {
      const response = await fetch('/api/settings/twilio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid,
          authToken,
          messagingServiceSid: messagingServiceSid || undefined,
          fromNumber: fromNumber || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Connection test failed')
      }

      setSuccess('Connection test successful!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Twilio SMS Integration</CardTitle>
        <CardDescription>
          Configure Twilio to send SMS messages. Use your Messaging Service SID or a dedicated From Number.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountSid">Account SID *</Label>
            <Input
              id="accountSid"
              type="text"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authToken">Auth Token *</Label>
            <Input
              id="authToken"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="********************************"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="messagingServiceSid">Messaging Service SID</Label>
            <Input
              id="messagingServiceSid"
              type="text"
              value={messagingServiceSid}
              onChange={(e) => setMessagingServiceSid(e.target.value)}
              placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <p className="text-xs text-gray-500">
              Recommended. If provided, Twilio will choose an optimized sender.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromNumber">From Number</Label>
            <Input
              id="fromNumber"
              type="text"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="+15551234567"
            />
            <p className="text-xs text-gray-500">
              Optional if Messaging Service SID is set. Must be a Twilio-verified number.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
              {success}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || !accountSid || !authToken}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
