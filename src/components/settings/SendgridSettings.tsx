'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SendgridSettingsProps {
  initialIntegration: any
}

export function SendgridSettings({ initialIntegration }: SendgridSettingsProps) {
  const [apiKey, setApiKey] = useState(initialIntegration?.apiKey || '')
  const [fromEmail, setFromEmail] = useState(initialIntegration?.fromEmail || '')
  const [fromName, setFromName] = useState(initialIntegration?.fromName || '')
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
      const response = await fetch('/api/settings/sendgrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          fromEmail,
          fromName: fromName || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      setSuccess('SendGrid integration saved successfully')
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
      const response = await fetch('/api/settings/sendgrid/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          fromEmail,
          fromName: fromName || undefined,
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
        <CardTitle>SendGrid Email Integration</CardTitle>
        <CardDescription>
          Configure SendGrid to send emails to patients. Get your API key from{' '}
          <a
            href="https://app.sendgrid.com/settings/api_keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            SendGrid Settings
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="SG.xxxxxxxxxxxxxxxxxxxxx"
              required
            />
            <p className="text-xs text-gray-500">
              Create an API key with &quot;Mail Send&quot; permissions in SendGrid
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromEmail">From Email Address *</Label>
            <Input
              id="fromEmail"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="noreply@yourpractice.com"
              required
            />
            <p className="text-xs text-gray-500">
              This email must be verified in SendGrid. Use a domain you own.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromName">From Name (Optional)</Label>
            <Input
              id="fromName"
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your Practice Name"
            />
            <p className="text-xs text-gray-500">
              Display name for sent emails (e.g., &quot;Dr. Smith&apos;s Practice&quot;)
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
              disabled={testingConnection || !apiKey || !fromEmail}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

