'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Loader2 } from 'lucide-react'

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  messagingProfileId?: string
  messagingProfileName?: string
  messagingReady: boolean
}

interface SmsSenderState {
  activeProvider: 'telnyx' | 'twilio' | null
  fromNumber: string | null
  telnyxConfigured: boolean
  twilioConfigured: boolean
  telnyx: {
    fromNumber: string
    phoneNumberId: string | null
    messagingProfileId: string | null
    apiKeyConfigured: boolean
  } | null
  twilio: {
    fromNumber: string | null
    messagingServiceSid: string | null
    configured: boolean
  } | null
}

interface SmsFromNumberSettingsProps {
  practiceId?: string
}

export function SmsFromNumberSettings({ practiceId }: SmsFromNumberSettingsProps) {
  const apiUrl = (path: string) => {
    if (practiceId) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}practiceId=${practiceId}`
    }
    return path
  }

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingNumbers, setLoadingNumbers] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [senderState, setSenderState] = useState<SmsSenderState | null>(null)
  const [fromNumber, setFromNumber] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [messagingProfileId, setMessagingProfileId] = useState('')
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])

  const usesTelnyxPicker = Boolean(
    senderState?.telnyx?.apiKeyConfigured &&
      (senderState.activeProvider === 'telnyx' || !senderState.twilio?.configured)
  )

  const loadSenderState = useCallback(async () => {
    if (!practiceId) {
      setSenderState(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/settings/sms/sender'))
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to load SMS sender settings')
      }
      const data = (await response.json()) as SmsSenderState
      setSenderState(data)
      setFromNumber(data.fromNumber || data.telnyx?.fromNumber || data.twilio?.fromNumber || '')
      setPhoneNumberId(data.telnyx?.phoneNumberId || '')
      setMessagingProfileId(data.telnyx?.messagingProfileId || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SMS sender settings')
    } finally {
      setLoading(false)
    }
  }, [practiceId])

  const loadTelnyxNumbers = useCallback(async () => {
    if (!practiceId) return

    setLoadingNumbers(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/settings/telnyx/phone-numbers'))
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to load phone numbers')
      }
      const data = await response.json()
      setPhoneNumbers(data.phoneNumbers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load phone numbers')
    } finally {
      setLoadingNumbers(false)
    }
  }, [practiceId])

  useEffect(() => {
    void loadSenderState()
  }, [loadSenderState])

  useEffect(() => {
    if (usesTelnyxPicker && senderState?.telnyx?.apiKeyConfigured) {
      void loadTelnyxNumbers()
    } else {
      setPhoneNumbers([])
    }
  }, [usesTelnyxPicker, senderState?.telnyx?.apiKeyConfigured, loadTelnyxNumbers])

  const selectedNumber = useMemo(
    () => phoneNumbers.find((entry) => entry.phoneNumber === fromNumber),
    [phoneNumbers, fromNumber]
  )

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
    setSaving(true)

    try {
      const response = await fetch(apiUrl('/api/settings/sms/sender'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNumber,
          phoneNumberId: phoneNumberId || undefined,
          messagingProfileId: messagingProfileId || undefined,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to save From Number')
      }

      const payload = await response.json()
      setSuccess(`From Number saved (${payload.provider}): ${payload.fromNumber}`)
      await loadSenderState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save From Number')
    } finally {
      setSaving(false)
    }
  }

  if (!practiceId) {
    return null
  }

  const providerLabel =
    senderState?.activeProvider === 'telnyx'
      ? 'Telnyx'
      : senderState?.activeProvider === 'twilio'
        ? 'Twilio'
        : senderState?.telnyx?.apiKeyConfigured
          ? 'Telnyx (configure sender below)'
          : senderState?.twilio?.configured
            ? 'Twilio (configure sender below)'
            : 'Not configured'

  return (
    <Card className="border border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle>SMS From Number</CardTitle>
        <CardDescription>
          Choose the phone number patients see when this practice sends SMS. Outbound texts always
          use this sender for the selected practice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sender settings...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
              <span className="text-gray-500">Active SMS provider: </span>
              <span className="font-medium text-gray-900">{providerLabel}</span>
              {senderState?.fromNumber && (
                <>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-gray-500">Current: </span>
                  <span className="font-mono text-gray-900">{senderState.fromNumber}</span>
                </>
              )}
            </div>

            {usesTelnyxPicker ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadTelnyxNumbers()}
                    disabled={loadingNumbers}
                  >
                    {loadingNumbers ? 'Refreshing...' : 'Refresh Telnyx Numbers'}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smsFromNumber">From Number *</Label>
                  {phoneNumbers.length > 0 ? (
                    <Select value={fromNumber} onValueChange={handleNumberChange}>
                      <SelectTrigger id="smsFromNumber">
                        <SelectValue placeholder="Select outbound SMS number" />
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
                      id="smsFromNumber"
                      type="text"
                      value={fromNumber}
                      onChange={(e) => setFromNumber(e.target.value)}
                      placeholder="+15551234567"
                      required
                    />
                  )}
                  <p className="text-xs text-gray-500">
                    Numbers are loaded from the Telnyx account configured for this practice. Only
                    messaging-ready numbers can be saved.
                  </p>
                  {selectedNumber && !selectedNumber.messagingReady && (
                    <p className="text-xs text-red-600">
                      Assign this number to a Telnyx messaging profile before saving.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="smsFromNumberTwilio">From Number *</Label>
                <Input
                  id="smsFromNumberTwilio"
                  type="text"
                  value={fromNumber}
                  onChange={(e) => setFromNumber(e.target.value)}
                  placeholder="+15551234567"
                  required
                />
                <p className="text-xs text-gray-500">
                  {senderState?.twilio?.messagingServiceSid
                    ? 'Twilio Messaging Service is configured; set a From Number here only if you want a fixed sender instead of the service pool.'
                    : 'Enter a Twilio-verified number, or configure Telnyx above for automatic number loading.'}
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">{success}</div>
            )}

            <Button
              type="submit"
              disabled={
                saving ||
                !fromNumber ||
                Boolean(selectedNumber && !selectedNumber.messagingReady)
              }
            >
              {saving ? 'Saving...' : 'Save From Number'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
