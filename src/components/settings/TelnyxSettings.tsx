'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  messagingProfileId?: string
  messagingProfileName?: string
  status?: string
  type?: string
  features: string[]
  messagingReady: boolean
}

interface TelnyxSettingsProps {
  initialIntegration: any
  practiceId?: string
}

export function TelnyxSettings({ initialIntegration, practiceId }: TelnyxSettingsProps) {
  const apiUrl = (path: string) => {
    if (practiceId) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}practiceId=${practiceId}`
    }
    return path
  }

  const [apiKey, setApiKey] = useState(initialIntegration?.apiKey || '')
  const [fromNumber, setFromNumber] = useState(initialIntegration?.fromNumber || '')
  const [phoneNumberId, setPhoneNumberId] = useState(initialIntegration?.phoneNumberId || '')
  const [messagingProfileId, setMessagingProfileId] = useState(
    initialIntegration?.messagingProfileId || ''
  )
  const [webhookPublicKey, setWebhookPublicKey] = useState(
    initialIntegration?.webhookPublicKey || ''
  )
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingNumbers, setLoadingNumbers] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    const fetchWebhookUrl = async () => {
      try {
        const response = await fetch('/api/settings/telnyx/webhook-url')
        if (response.ok) {
          const data = await response.json()
          setWebhookUrl(data.webhookUrl || '')
        }
      } catch {
        setWebhookUrl('https://app.getvantage.tech/api/webhooks/telnyx')
      }
    }
    fetchWebhookUrl()
  }, [])

  const selectedNumber = useMemo(
    () => phoneNumbers.find((entry) => entry.phoneNumber === fromNumber),
    [phoneNumbers, fromNumber]
  )

  const handleLoadPhoneNumbers = async () => {
    setError('')
    setSuccess('')
    setLoadingNumbers(true)

    try {
      const response = await fetch('/api/settings/telnyx/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to load phone numbers')
      }

      const data = await response.json()
      setPhoneNumbers(data.phoneNumbers || [])

      if (!fromNumber && data.phoneNumbers?.length === 1) {
        const only = data.phoneNumbers[0]
        setFromNumber(only.phoneNumber)
        setPhoneNumberId(only.id)
        setMessagingProfileId(only.messagingProfileId || '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load phone numbers')
    } finally {
      setLoadingNumbers(false)
    }
  }

  const handleNumberChange = (value: string) => {
    setFromNumber(value)
    const match = phoneNumbers.find((entry) => entry.phoneNumber === value)
    setPhoneNumberId(match?.id || '')
    setMessagingProfileId(match?.messagingProfileId || '')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(apiUrl('/api/settings/telnyx'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          fromNumber,
          phoneNumberId: phoneNumberId || undefined,
          messagingProfileId: messagingProfileId || undefined,
          webhookPublicKey: webhookPublicKey || undefined,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to save settings')
      }

      setSuccess('Telnyx integration saved successfully')
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
      const response = await fetch('/api/settings/telnyx/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Connection test failed')
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
        <CardTitle>Telnyx SMS Integration</CardTitle>
        <CardDescription>
          Configure Telnyx per practice. When active, Telnyx is used instead of Twilio for outbound SMS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Configure Telnyx after saving here</p>
            <p className="mt-1">
              In Telnyx Mission Control, open your messaging profile&apos;s <strong>Inbound</strong>{' '}
              settings and set the webhook URL to:
            </p>
            <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-xs">
              {webhookUrl || 'https://app.getvantage.tech/api/webhooks/telnyx'}
            </code>
            <p className="mt-2">
              Also assign the selected phone number to that messaging profile so inbound SMS and delivery
              events reach Vantage.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telnyxApiKey">API Key *</Label>
            <Input
              id="telnyxApiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="KEYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || !apiKey}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleLoadPhoneNumbers}
              disabled={loadingNumbers || !apiKey}
            >
              {loadingNumbers ? 'Loading numbers...' : 'Load Phone Numbers'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telnyxWebhookPublicKey">Webhook Public Key</Label>
            <Input
              id="telnyxWebhookPublicKey"
              type="text"
              value={webhookPublicKey}
              onChange={(e) => setWebhookPublicKey(e.target.value)}
              placeholder="Base64 public key from Telnyx → Keys & Credentials"
            />
            <p className="text-xs text-gray-500">
              Used to verify inbound Telnyx webhooks. You can also set{' '}
              <code className="rounded bg-gray-100 px-1">TELNYX_WEBHOOK_PUBLIC_KEY</code> globally in
              Vercel instead.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telnyxFromNumber">Practice SMS Number *</Label>
            {phoneNumbers.length > 0 ? (
              <Select value={fromNumber} onValueChange={handleNumberChange}>
                <SelectTrigger id="telnyxFromNumber">
                  <SelectValue placeholder="Select a Telnyx phone number" />
                </SelectTrigger>
                <SelectContent>
                  {phoneNumbers.map((entry) => (
                    <SelectItem key={entry.id} value={entry.phoneNumber}>
                      {entry.phoneNumber}
                      {entry.messagingProfileName ? ` · ${entry.messagingProfileName}` : ''}
                      {!entry.messagingReady ? ' · not messaging-ready' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="telnyxFromNumber"
                type="text"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                placeholder="+15551234567"
                required
              />
            )}
            <p className="text-xs text-gray-500">
              Load numbers from Telnyx to pick the sender for this practice. Only messaging-ready numbers can
              be saved.
            </p>
            {selectedNumber && !selectedNumber.messagingReady && (
              <p className="text-xs text-red-600">
                This number is not assigned to a messaging profile yet. Finish Telnyx setup before saving.
              </p>
            )}
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
            <Button
              type="submit"
              disabled={
                loading ||
                !apiKey ||
                !fromNumber ||
                Boolean(selectedNumber && !selectedNumber.messagingReady)
              }
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
