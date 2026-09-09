'use client'

import { useEffect, useState } from 'react'
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
import { SMS_HOSTED_NUMBER_HELP } from '@/lib/sms-sender-validation'

interface ApidazePhoneNumber {
  id: string
  phoneNumber: string
}

interface ApidazeSettingsProps {
  initialIntegration?: {
    fromNumber?: string
    isActive?: boolean
  } | null
  practiceId?: string
}

export function ApidazeSettings({ initialIntegration, practiceId }: ApidazeSettingsProps) {
  const apiUrl = (path: string) => {
    if (practiceId) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}practiceId=${practiceId}`
    }
    return path
  }

  const [platformConfigured, setPlatformConfigured] = useState(false)
  const [fromNumber, setFromNumber] = useState(initialIntegration?.fromNumber || '')
  const [phoneNumbers, setPhoneNumbers] = useState<ApidazePhoneNumber[]>([])
  const [webhookUrl, setWebhookUrl] = useState('https://app.getvantage.tech/api/webhooks/apidaze')
  const [loading, setLoading] = useState(false)
  const [loadingNumbers, setLoadingNumbers] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setFromNumber(initialIntegration?.fromNumber || '')
  }, [initialIntegration])

  const loadSettings = async () => {
    try {
      const response = await fetch(apiUrl('/api/settings/apidaze'))
      if (!response.ok) return
      const data = await response.json()
      setPlatformConfigured(Boolean(data.platformConfigured))
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl)
      if (data.integration?.fromNumber) setFromNumber(data.integration.fromNumber)
    } catch {
      setWebhookUrl('https://app.getvantage.tech/api/webhooks/apidaze')
    }
  }

  const handleLoadPhoneNumbers = async () => {
    setError('')
    setSuccess('')
    setLoadingNumbers(true)
    try {
      const response = await fetch('/api/settings/apidaze/phone-numbers')
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to load phone numbers')
      }
      const data = await response.json()
      setPhoneNumbers(data.phoneNumbers || [])
      if (!fromNumber && data.phoneNumbers?.length === 1) {
        setFromNumber(data.phoneNumbers[0].phoneNumber)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load phone numbers')
    } finally {
      setLoadingNumbers(false)
    }
  }

  useEffect(() => {
    void loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId])

  useEffect(() => {
    if (platformConfigured) {
      void handleLoadPhoneNumbers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformConfigured])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(apiUrl('/api/settings/apidaze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromNumber }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to save settings')
      }

      setSuccess('Apidaze from-number saved. Outbound SMS for this practice will use this number.')
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
      const response = await fetch(apiUrl('/api/settings/apidaze/test'), {
        method: 'POST',
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Connection test failed')
      }

      const payload = await response.json()
      const count = typeof payload.numberCount === 'number' ? payload.numberCount : 0
      setSuccess(
        count > 0
          ? `Apidaze connection ok. Found ${count} number${count === 1 ? '' : 's'} on the application.`
          : 'Apidaze credentials were accepted, but no numbers were returned for this application.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apidaze SMS</CardTitle>
        <CardDescription>
          Send and receive texts from this practice&apos;s phone number using the shared Vantage
          Apidaze application. Credentials live in server env, not per practice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Inbound webhook</p>
            <p className="mt-1">
              In the Apidaze application External Script, set <strong>sms_url</strong> to:
            </p>
            <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-xs">
              {webhookUrl}
            </code>
            <p className="mt-2">
              The number must already be assigned to the Vantage Apidaze application.{' '}
              <a
                href={SMS_HOSTED_NUMBER_HELP.apidazeDocs}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                API docs
              </a>
            </p>
          </div>

          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            <span className="text-gray-500">Platform credentials: </span>
            <span className="font-medium text-gray-900">
              {platformConfigured ? 'Configured' : 'Missing APIDAZE_API_KEY / APIDAZE_API_SECRET'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || !platformConfigured}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleLoadPhoneNumbers()}
              disabled={loadingNumbers || !platformConfigured}
            >
              {loadingNumbers ? 'Loading numbers...' : 'Load Phone Numbers'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apidazeFromNumber">From Number *</Label>
            {phoneNumbers.length > 0 ? (
              <Select value={fromNumber} onValueChange={setFromNumber}>
                <SelectTrigger id="apidazeFromNumber">
                  <SelectValue placeholder="Select a number on the Apidaze application" />
                </SelectTrigger>
                <SelectContent>
                  {phoneNumbers.map((entry) => (
                    <SelectItem key={entry.id} value={entry.phoneNumber}>
                      {entry.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="apidazeFromNumber"
                type="text"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                placeholder="+15551234567"
                required
              />
            )}
            <p className="text-xs text-gray-500">
              Patients see this number. It must already live on the Vantage Apidaze app.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">{success}</div>
          )}

          <Button type="submit" disabled={loading || !fromNumber || !platformConfigured}>
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
