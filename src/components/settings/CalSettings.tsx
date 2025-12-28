'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CalSettingsProps {
  initialIntegration: any
}

export function CalSettings({ initialIntegration }: CalSettingsProps) {
  const [apiKey, setApiKey] = useState(initialIntegration?.apiKey || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/settings/cal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          calOrganizationId: initialIntegration?.calOrganizationId,
          calTeamId: initialIntegration?.calTeamId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      setSuccess('Cal.com integration saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/settings/cal/test')
      const data = await response.json()

      if (data.success) {
        setSuccess('Connection test successful!')
      } else {
        setError(data.message || 'Connection test failed')
      }
    } catch (err) {
      setError('Connection test failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cal.com Integration</CardTitle>
        <CardDescription>Configure your Cal.com API credentials</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Cal.com API key"
              required
            />
            <p className="text-xs text-muted-foreground">
              You can find your API key in your Cal.com settings
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          {success && (
            <div className="text-sm text-green-600">{success}</div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={loading || !apiKey}
            >
              Test Connection
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

