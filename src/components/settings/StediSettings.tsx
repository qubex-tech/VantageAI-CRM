'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface StediSettingsProps {
  initialIntegration: {
    environment?: string | null
    apiBaseUrl?: string | null
    useMockResponses?: boolean
    isActive?: boolean
    hasApiKey?: boolean
  } | null
  practiceId?: string
}

export function StediSettings({ initialIntegration, practiceId }: StediSettingsProps) {
  const apiUrl = (path: string) => {
    if (practiceId) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}practiceId=${practiceId}`
    }
    return path
  }

  const [apiKey, setApiKey] = useState('')
  const [environment, setEnvironment] = useState<'test' | 'production'>(
    initialIntegration?.environment === 'production' ? 'production' : 'test'
  )
  const [apiBaseUrl, setApiBaseUrl] = useState(initialIntegration?.apiBaseUrl || '')
  const [useMockResponses, setUseMockResponses] = useState(
    initialIntegration?.useMockResponses ?? true
  )
  const [isActive, setIsActive] = useState(initialIntegration?.isActive ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const hasApiKey = Boolean(initialIntegration?.hasApiKey)

  useEffect(() => {
    setApiKey('')
    setEnvironment(initialIntegration?.environment === 'production' ? 'production' : 'test')
    setApiBaseUrl(initialIntegration?.apiBaseUrl || '')
    setUseMockResponses(initialIntegration?.useMockResponses ?? true)
    setIsActive(initialIntegration?.isActive ?? false)
  }, [initialIntegration])

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(apiUrl('/api/settings/stedi'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          apiKey: apiKey || undefined,
          environment,
          apiBaseUrl,
          useMockResponses,
          isActive,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save Stedi settings')
      }
      setApiKey('')
      setSuccess('Stedi settings saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">Stedi</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Real-time 270/271 eligibility checks. Select Stedi as the API clearinghouse above. The
          API key can live on this practice or in Vercel as STEDI_API_KEY. Uses the provider NPI
          and organization name from eligibility settings. Turn mock off for live payer checks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <Label className="font-medium">Enable Stedi connection</Label>
            <p className="text-sm text-gray-500 mt-1">
              Required before this practice can send live or mock checks through Stedi
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} disabled={loading} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <Label className="font-medium">Use mock API responses</Label>
            <p className="text-sm text-gray-500 mt-1">
              Returns demo eligibility data without calling Stedi. Turn off to use a test or
              production API key.
            </p>
          </div>
          <Switch
            checked={useMockResponses}
            onCheckedChange={setUseMockResponses}
            disabled={loading || !isActive}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="stediApiKey">API key</Label>
            <Input
              id="stediApiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                hasApiKey
                  ? 'Saved (enter to replace)'
                  : 'From Stedi, or leave blank if STEDI_API_KEY is set in Vercel'
              }
              className="mt-1"
              disabled={!isActive}
            />
          </div>
          <div>
            <Label>Key mode</Label>
            <Select
              value={environment}
              onValueChange={(v) => setEnvironment(v as 'test' | 'production')}
              disabled={!isActive}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="stediApiBaseUrl">API base URL (optional)</Label>
            <Input
              id="stediApiBaseUrl"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://healthcare.us.stedi.com/2024-04-01"
              className="mt-1"
              disabled={!isActive}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}

        <Button onClick={() => void handleSave()} disabled={loading}>
          {loading ? 'Saving…' : 'Save Stedi settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
