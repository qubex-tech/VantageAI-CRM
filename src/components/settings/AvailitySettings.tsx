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

interface AvailitySettingsProps {
  initialIntegration: {
    clientId?: string | null
    environment?: string | null
    apiBaseUrl?: string | null
    defaultProviderNpi?: string | null
    defaultProviderTaxId?: string | null
    defaultServiceType?: string | null
    submitterId?: string | null
    submitterStateCode?: string | null
    useMockResponses?: boolean
    isActive?: boolean
    hasClientSecret?: boolean
  } | null
  practiceId?: string
}

export function AvailitySettings({ initialIntegration, practiceId }: AvailitySettingsProps) {
  const apiUrl = (path: string) => {
    if (practiceId) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}practiceId=${practiceId}`
    }
    return path
  }

  const [clientId, setClientId] = useState(initialIntegration?.clientId || '')
  const [clientSecret, setClientSecret] = useState('')
  const [environment, setEnvironment] = useState<'demo' | 'production'>(
    initialIntegration?.environment === 'production' ? 'production' : 'demo'
  )
  const [apiBaseUrl, setApiBaseUrl] = useState(initialIntegration?.apiBaseUrl || '')
  const [defaultProviderNpi, setDefaultProviderNpi] = useState(initialIntegration?.defaultProviderNpi || '')
  const [defaultProviderTaxId, setDefaultProviderTaxId] = useState(
    initialIntegration?.defaultProviderTaxId || ''
  )
  const [defaultServiceType, setDefaultServiceType] = useState(
    initialIntegration?.defaultServiceType || '30'
  )
  const [submitterId, setSubmitterId] = useState(initialIntegration?.submitterId || '')
  const [submitterStateCode, setSubmitterStateCode] = useState(
    initialIntegration?.submitterStateCode || ''
  )
  const [useMockResponses, setUseMockResponses] = useState(
    initialIntegration?.useMockResponses ?? true
  )
  const [isActive, setIsActive] = useState(initialIntegration?.isActive ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const hasClientSecret = Boolean(initialIntegration?.hasClientSecret)

  useEffect(() => {
    setClientId(initialIntegration?.clientId || '')
    setClientSecret('')
    setEnvironment(initialIntegration?.environment === 'production' ? 'production' : 'demo')
    setApiBaseUrl(initialIntegration?.apiBaseUrl || '')
    setDefaultProviderNpi(initialIntegration?.defaultProviderNpi || '')
    setDefaultProviderTaxId(initialIntegration?.defaultProviderTaxId || '')
    setDefaultServiceType(initialIntegration?.defaultServiceType || '30')
    setSubmitterId(initialIntegration?.submitterId || '')
    setSubmitterStateCode(initialIntegration?.submitterStateCode || '')
    setUseMockResponses(initialIntegration?.useMockResponses ?? true)
    setIsActive(initialIntegration?.isActive ?? true)
  }, [initialIntegration])

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(apiUrl('/api/settings/availity'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          clientId,
          clientSecret: clientSecret || undefined,
          environment,
          apiBaseUrl,
          defaultProviderNpi,
          defaultProviderTaxId,
          defaultServiceType,
          submitterId,
          submitterStateCode,
          useMockResponses,
          isActive,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save Availity settings')
      }
      setClientSecret('')
      setSuccess('Availity settings saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">Availity Eligibility</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Configure Availity Coverages API (270/271) for real-time insurance eligibility checks.
          Use mock mode until production credentials are provisioned.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <Label className="font-medium">Enable Availity integration</Label>
            <p className="text-sm text-gray-500 mt-1">Required for API eligibility checks</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} disabled={loading} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <Label className="font-medium">Use mock responses</Label>
            <p className="text-sm text-gray-500 mt-1">
              Returns demo eligibility data without live Availity credentials
            </p>
          </div>
          <Switch checked={useMockResponses} onCheckedChange={setUseMockResponses} disabled={loading} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="availityClientId">Client ID (API key)</Label>
            <Input
              id="availityClientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="From Availity developer portal"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="availityClientSecret">Client secret</Label>
            <Input
              id="availityClientSecret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={hasClientSecret ? 'Saved (enter to replace)' : 'Client secret'}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Environment</Label>
            <Select value={environment} onValueChange={(v) => setEnvironment(v as 'demo' | 'production')}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demo">Demo / sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="defaultProviderNpi">Provider NPI *</Label>
            <Input
              id="defaultProviderNpi"
              value={defaultProviderNpi}
              onChange={(e) => setDefaultProviderNpi(e.target.value)}
              placeholder="10-digit NPI"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="defaultProviderTaxId">Provider tax ID</Label>
            <Input
              id="defaultProviderTaxId"
              value={defaultProviderTaxId}
              onChange={(e) => setDefaultProviderTaxId(e.target.value)}
              placeholder="Optional"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="defaultServiceType">Default service type</Label>
            <Input
              id="defaultServiceType"
              value={defaultServiceType}
              onChange={(e) => setDefaultServiceType(e.target.value)}
              placeholder="30"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="submitterId">Submitter ID</Label>
            <Input
              id="submitterId"
              value={submitterId}
              onChange={(e) => setSubmitterId(e.target.value)}
              placeholder="Payer-specific if required"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="submitterStateCode">Submitter state code</Label>
            <Input
              id="submitterStateCode"
              value={submitterStateCode}
              onChange={(e) => setSubmitterStateCode(e.target.value)}
              placeholder="e.g. FL"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="apiBaseUrl">API base URL override</Label>
            <Input
              id="apiBaseUrl"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://api.availity.com/availity/v1"
              className="mt-1"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save Availity settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
