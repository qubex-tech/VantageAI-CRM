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
    eligibilityApiEnabled?: boolean
    portalRpaEnabled?: boolean
    portalRpaUseMock?: boolean
    eligibilityVoiceEnabled?: boolean
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
  const [defaultProviderNpi, setDefaultProviderNpi] = useState(
    initialIntegration?.defaultProviderNpi || ''
  )
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
  const [eligibilityApiEnabled, setEligibilityApiEnabled] = useState(
    initialIntegration?.eligibilityApiEnabled ?? initialIntegration?.isActive ?? true
  )
  const [portalRpaEnabled, setPortalRpaEnabled] = useState(
    initialIntegration?.portalRpaEnabled ?? false
  )
  const [portalRpaUseMock, setPortalRpaUseMock] = useState(
    initialIntegration?.portalRpaUseMock ?? true
  )
  const [eligibilityVoiceEnabled, setEligibilityVoiceEnabled] = useState(
    initialIntegration?.eligibilityVoiceEnabled ?? true
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [portalUsername, setPortalUsername] = useState('')
  const [portalPassword, setPortalPassword] = useState('')
  const [portalTotp, setPortalTotp] = useState('')
  const [hasPortalPassword, setHasPortalPassword] = useState(false)
  const [hasPortalTotp, setHasPortalTotp] = useState(false)
  const [portalCredLoading, setPortalCredLoading] = useState(false)

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
    setEligibilityApiEnabled(
      initialIntegration?.eligibilityApiEnabled ?? initialIntegration?.isActive ?? true
    )
    setPortalRpaEnabled(initialIntegration?.portalRpaEnabled ?? false)
    setPortalRpaUseMock(initialIntegration?.portalRpaUseMock ?? true)
    setEligibilityVoiceEnabled(initialIntegration?.eligibilityVoiceEnabled ?? true)
  }, [initialIntegration])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/settings/browser-credentials?site=availity'))
        if (!res.ok) return
        const data = await res.json()
        const cred = data.credentials?.[0]
        if (!cancelled && cred) {
          setPortalUsername(cred.username || '')
          setHasPortalPassword(Boolean(cred.hasPassword))
          setHasPortalTotp(Boolean(cred.hasTotpSecret))
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId])

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
          eligibilityApiEnabled,
          portalRpaEnabled,
          portalRpaUseMock,
          eligibilityVoiceEnabled,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings')
      }
      setClientSecret('')
      setSuccess('Insurance Eligibility Agent settings saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePortalCredentials = async () => {
    setPortalCredLoading(true)
    setError('')
    setSuccess('')
    try {
      if (!portalUsername.trim()) {
        throw new Error('Portal username is required')
      }
      if (!portalPassword && !hasPortalPassword) {
        throw new Error('Portal password is required')
      }
      const response = await fetch(apiUrl('/api/settings/browser-credentials'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          site: 'availity',
          username: portalUsername,
          password: portalPassword || undefined,
          totpSecret: portalTotp || undefined,
          isActive: true,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save portal credentials')
      }
      setPortalPassword('')
      setPortalTotp('')
      setHasPortalPassword(Boolean(data.credential?.hasPassword))
      setHasPortalTotp(Boolean(data.credential?.hasTotpSecret))
      setSuccess('Availity portal credentials saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save portal credentials')
    } finally {
      setPortalCredLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">
          Insurance Eligibility Agent
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Choose which verification methods this practice uses. Enabled methods run in order: API →
          portal RPA → call to insurance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-gray-200 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Verification methods</h3>
            <p className="text-sm text-gray-500 mt-1">
              Toggle each path on or off. Disabled methods are skipped in the cascade.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Availity API</Label>
              <p className="text-sm text-gray-500 mt-1">
                Coverages API (270/271) real-time eligibility inquiry
              </p>
            </div>
            <Switch
              checked={eligibilityApiEnabled}
              onCheckedChange={setEligibilityApiEnabled}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Availity portal RPA</Label>
              <p className="text-sm text-gray-500 mt-1">
                Browser automation of Availity Eligibility &amp; Benefits
              </p>
            </div>
            <Switch
              checked={portalRpaEnabled}
              onCheckedChange={setPortalRpaEnabled}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Call to insurance</Label>
              <p className="text-sm text-gray-500 mt-1">
                Outbound voice agent call when earlier methods fail or are disabled
              </p>
            </div>
            <Switch
              checked={eligibilityVoiceEnabled}
              onCheckedChange={setEligibilityVoiceEnabled}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <Label className="font-medium">Use mock API responses</Label>
            <p className="text-sm text-gray-500 mt-1">
              Returns demo eligibility data without live Availity API credentials
            </p>
          </div>
          <Switch
            checked={useMockResponses}
            onCheckedChange={setUseMockResponses}
            disabled={loading || !eligibilityApiEnabled}
          />
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
              disabled={!eligibilityApiEnabled}
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
              disabled={!eligibilityApiEnabled}
            />
          </div>
          <div>
            <Label>Environment</Label>
            <Select
              value={environment}
              onValueChange={(v) => setEnvironment(v as 'demo' | 'production')}
              disabled={!eligibilityApiEnabled}
            >
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
              disabled={!eligibilityApiEnabled}
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
              disabled={!eligibilityApiEnabled}
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
              disabled={!eligibilityApiEnabled}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Portal automation credentials</h3>
            <p className="text-sm text-gray-500 mt-1">
              Used when portal RPA is enabled. Requires Browserbase for live browsers, or mock mode
              for dry runs.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Use mock portal results</Label>
              <p className="text-sm text-gray-500 mt-1">
                Skip live browser login; return synthetic eligibility for testing
              </p>
            </div>
            <Switch
              checked={portalRpaUseMock}
              onCheckedChange={setPortalRpaUseMock}
              disabled={loading || !portalRpaEnabled}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="portalUsername">Portal username</Label>
              <Input
                id="portalUsername"
                value={portalUsername}
                onChange={(e) => setPortalUsername(e.target.value)}
                placeholder="Availity login"
                className="mt-1"
                autoComplete="off"
                disabled={!portalRpaEnabled}
              />
            </div>
            <div>
              <Label htmlFor="portalPassword">Portal password</Label>
              <Input
                id="portalPassword"
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder={hasPortalPassword ? 'Saved (enter to replace)' : 'Portal password'}
                className="mt-1"
                autoComplete="new-password"
                disabled={!portalRpaEnabled}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="portalTotp">TOTP secret (optional MFA)</Label>
              <Input
                id="portalTotp"
                type="password"
                value={portalTotp}
                onChange={(e) => setPortalTotp(e.target.value)}
                placeholder={hasPortalTotp ? 'Saved (enter to replace)' : 'Base32 authenticator secret'}
                className="mt-1"
                autoComplete="off"
                disabled={!portalRpaEnabled}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleSavePortalCredentials}
            disabled={portalCredLoading || !portalRpaEnabled}
          >
            {portalCredLoading ? 'Saving…' : 'Save portal credentials'}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save Insurance Eligibility Agent'}
        </Button>
      </CardContent>
    </Card>
  )
}
