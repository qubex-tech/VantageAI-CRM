'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RetellSettingsProps {
  initialIntegration: any
}

export function RetellSettings({ initialIntegration }: RetellSettingsProps) {
  const [apiKey, setApiKey] = useState(initialIntegration?.apiKey || '')
  const [agentId, setAgentId] = useState(initialIntegration?.agentId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setApiKey(initialIntegration?.apiKey || '')
    setAgentId(initialIntegration?.agentId || '')
  }, [initialIntegration])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/settings/retell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          agentId: agentId || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      setSuccess('RetellAI integration saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setError('')
    setSuccess('')
    setTesting(true)

    try {
      const response = await fetch('/api/settings/retell/test')
      const data = await response.json()

      if (data.success) {
        setSuccess('Connection test successful!')
      } else {
        setError(data.message || 'Connection test failed')
      }
    } catch (err) {
      setError('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">RetellAI Integration</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Configure your RetellAI API key to view and manage voice agent calls
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
              API Key *
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your RetellAI API key"
              className="font-mono text-sm"
              required
            />
            <p className="text-xs text-gray-500">
              Get your API key from{' '}
              <a
                href="https://retellai.com/dashboard/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                RetellAI Dashboard → Settings → API Keys
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentId" className="text-sm font-medium text-gray-700">
              Agent ID (Optional)
            </Label>
            <Input
              id="agentId"
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="Default agent ID for this practice"
              className="text-sm"
            />
            <p className="text-xs text-gray-500">
              Optionally specify a default agent ID to filter calls by agent
            </p>
          </div>

          {(error || success) && (
            <div
              className={`p-3 rounded-md text-sm ${
                error
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-green-50 text-green-600 border border-green-200'
              }`}
            >
              {error || success}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || testing}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={loading || testing || !apiKey}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

