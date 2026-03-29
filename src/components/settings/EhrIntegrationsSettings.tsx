'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

type Provider = {
  id: string
  displayName: string
  description?: string
  uiFields: Array<{
    id: string
    label: string
    type: 'text' | 'password' | 'url' | 'select' | 'boolean'
    placeholder?: string
    helpText?: string
    required?: boolean
    options?: Array<{ label: string; value: string }>
  }>
  supportsBulkExport?: boolean
}

type EhrSettings = {
  enabledProviders: string[]
  providerConfigs: Record<string, Record<string, any>>
  enableWrite?: boolean
  enablePatientCreate?: boolean
  enableNoteCreate?: boolean
  enableBulkExport?: boolean
}

type StatusResponse = {
  connected: boolean
  status?: string
  issuer?: string
  fhirBaseUrl?: string
  scopes?: string
  expiresAt?: string
  idTokenClaimsSummary?: any
  capabilitiesSummary?: any
}

const fallbackProviders: Provider[] = [
  {
    id: 'ecw',
    displayName: 'eClinicalWorks (eCW)',
    uiFields: [
      { id: 'issuer', label: 'Issuer URL', type: 'url', required: true },
      { id: 'fhirBaseUrl', label: 'FHIR Base URL (optional override)', type: 'url' },
      { id: 'clientId', label: 'Client ID', type: 'text', required: true },
      { id: 'clientSecret', label: 'Client Secret (optional)', type: 'password' },
      {
        id: 'authFlow',
        label: 'Auth Flow',
        type: 'select',
        options: [
          { label: 'SMART App Launch (user login)', value: 'smart_launch' },
          { label: 'Backend Services (client_credentials)', value: 'backend_services' },
        ],
        helpText: 'Use SMART App Launch for CRM user sign-in. Use Backend Services for server-to-server.',
      },
    ],
  },
  {
    id: 'ecw_bulk',
    displayName: 'eClinicalWorks - Backend (Bulk Read)',
    uiFields: [
      { id: 'issuer', label: 'Issuer URL', type: 'url', required: true },
      { id: 'fhirBaseUrl', label: 'FHIR Base URL (optional override)', type: 'url' },
      { id: 'clientId', label: 'Client ID', type: 'text', required: true },
      { id: 'clientSecret', label: 'Client Secret (optional)', type: 'password' },
    ],
    supportsBulkExport: true,
  },
  {
    id: 'ecw_write',
    displayName: 'eClinicalWorks - Backend (Write)',
    uiFields: [
      { id: 'issuer', label: 'Issuer URL', type: 'url', required: true },
      { id: 'fhirBaseUrl', label: 'FHIR Base URL (optional override)', type: 'url' },
      { id: 'clientId', label: 'Client ID', type: 'text', required: true },
      { id: 'clientSecret', label: 'Client Secret (optional)', type: 'password' },
      {
        id: 'ecwTelephoneParticipantPractitionerRef',
        label: 'Telephone Encounter Practitioner Ref',
        type: 'text',
      },
      {
        id: 'ecwTelephoneAssignedToPractitionerRef',
        label: 'Telephone Encounter Assigned-To Ref',
        type: 'text',
      },
      {
        id: 'ecwTelephoneLocationRef',
        label: 'Telephone Encounter Location Ref',
        type: 'text',
      },
      {
        id: 'ecwTelephoneOrganizationRef',
        label: 'Telephone Encounter Organization Ref',
        type: 'text',
      },
    ],
  },
  {
    id: 'pcc',
    displayName: 'PointClickCare (PCC)',
    uiFields: [
      { id: 'issuer', label: 'Issuer URL', type: 'url', required: true },
      { id: 'fhirBaseUrl', label: 'FHIR Base URL (optional override)', type: 'url' },
      { id: 'clientId', label: 'Client ID', type: 'text', required: true },
      { id: 'clientSecret', label: 'Client Secret (optional)', type: 'password' },
      { id: 'pccTenantId', label: 'PCC Tenant ID', type: 'text', required: true },
    ],
  },
]

export function EhrIntegrationsSettings({ practiceId }: { practiceId?: string }) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [settings, setSettings] = useState<EhrSettings>({
    enabledProviders: [],
    providerConfigs: {},
    enableWrite: false,
    enablePatientCreate: false,
    enableNoteCreate: false,
    enableBulkExport: false,
  })
  const [selectedProviderId, setSelectedProviderId] = useState<string>('ecw')
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientId, setPatientId] = useState('')
  const [notePatientId, setNotePatientId] = useState('')
  const [noteText, setNoteText] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [noteResult, setNoteResult] = useState<string | null>(null)
  const [requireBinary, setRequireBinary] = useState(false)
  const [origin, setOrigin] = useState('')
  const [bulkResult, setBulkResult] = useState<string | null>(null)
  const [practices, setPractices] = useState<Array<{ id: string; name: string }>>([])
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('')
  const [privateKeyJwtConfigured, setPrivateKeyJwtConfigured] = useState(true)
  const [ecwStatusMap, setEcwStatusMap] = useState<Record<string, StatusResponse | null>>({})

  const resolvedProviders = providers.length > 0 ? providers : fallbackProviders
  const selectedProvider = useMemo(
    () => resolvedProviders.find((provider) => provider.id === selectedProviderId),
    [resolvedProviders, selectedProviderId]
  )

  const activePracticeId = practiceId || selectedPracticeId
  const isEcwProvider = selectedProviderId.startsWith('ecw')
  const isBackendProvider = selectedProviderId.startsWith('ecw_')
  const requiresEcwKey =
    isEcwProvider && settings.enabledProviders.includes(selectedProviderId) && !privateKeyJwtConfigured

  const apiUrl = (path: string) => {
    if (!activePracticeId) return path
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}practiceId=${encodeURIComponent(activePracticeId)}`
  }

  const fetchSettings = async () => {
    if (!activePracticeId) {
      return
    }
    const response = await fetch(apiUrl('/api/integrations/ehr/config'))
    if (response.ok) {
      const data = await response.json()
      if (data.providers) setProviders(data.providers)
      if (typeof data.privateKeyJwtConfigured === 'boolean') {
        setPrivateKeyJwtConfigured(data.privateKeyJwtConfigured)
      }
      if (data.settings) {
        setSettings({
          enabledProviders: data.settings.enabledProviders || [],
          providerConfigs: data.settings.providerConfigs || {},
          enableWrite: data.settings.enableWrite ?? false,
          enablePatientCreate: data.settings.enablePatientCreate ?? false,
          enableNoteCreate: data.settings.enableNoteCreate ?? false,
          enableBulkExport: data.settings.enableBulkExport ?? false,
        })
      }
    }
  }

  const fetchStatus = async () => {
    if (!selectedProviderId || !activePracticeId) return
    const params = new URLSearchParams()
    params.set('providerId', selectedProviderId)
    params.set('includeCapabilities', '1')
    if (activePracticeId) params.set('practiceId', activePracticeId)
    const response = await fetch(`/api/integrations/ehr/status?${params.toString()}`)
    if (response.ok) {
      const data = await response.json()
      setStatus(data)
    }
  }

  const fetchEcwStatuses = async () => {
    if (!activePracticeId) return
    const providerIds = ['ecw', 'ecw_bulk', 'ecw_write']
    const results = await Promise.all(
      providerIds.map(async (providerId) => {
        const params = new URLSearchParams()
        params.set('providerId', providerId)
        if (activePracticeId) params.set('practiceId', activePracticeId)
        const response = await fetch(`/api/integrations/ehr/status?${params.toString()}`)
        if (!response.ok) {
          return [providerId, null] as const
        }
        const data = (await response.json()) as StatusResponse
        return [providerId, data] as const
      })
    )
    setEcwStatusMap(Object.fromEntries(results))
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (!practiceId) {
          const response = await fetch('/api/practices')
          if (response.ok) {
            const data = await response.json()
            setPractices(data.practices || [])
            if (!selectedPracticeId && data.practices?.[0]?.id) {
              setSelectedPracticeId(data.practices[0].id)
            }
          }
        }
        await fetchSettings()
        if (resolvedProviders.length > 0 && !selectedProviderId) {
          setSelectedProviderId(resolvedProviders[0].id)
        }
        await fetchStatus()
      } catch (err) {
        setError('Failed to load EHR integration settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    if (activePracticeId) {
      fetchSettings()
      fetchStatus()
      fetchEcwStatuses()
    }
  }, [selectedProviderId, activePracticeId])

  useEffect(() => {
    if (!selectedProviderId && resolvedProviders.length > 0) {
      setSelectedProviderId(resolvedProviders[0].id)
    }
  }, [resolvedProviders, selectedProviderId])

  const updateProviderConfig = (fieldId: string, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      providerConfigs: {
        ...prev.providerConfigs,
        [selectedProviderId]: {
          ...(prev.providerConfigs[selectedProviderId] || {}),
          [fieldId]: value,
        },
      },
    }))
  }

  const toggleProviderEnabled = (enabled: boolean) => {
    setSettings((prev) => {
      const current = new Set(prev.enabledProviders)
      if (enabled) current.add(selectedProviderId)
      else current.delete(selectedProviderId)
      return { ...prev, enabledProviders: Array.from(current) }
    })
  }

  const renderEcwStatus = (providerId: string) => {
    if (!settings.enabledProviders.includes(providerId)) {
      return { label: 'Disabled', tone: 'text-gray-500 bg-gray-100 border-gray-200' }
    }
    const statusEntry = ecwStatusMap[providerId]
    if (!statusEntry) {
      return { label: 'Unknown', tone: 'text-gray-500 bg-gray-100 border-gray-200' }
    }
    if (statusEntry.connected) {
      return { label: 'Connected', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    }
    return { label: statusEntry.status || 'Disconnected', tone: 'text-amber-700 bg-amber-50 border-amber-200' }
  }

  const saveSettings = async () => {
    if (requiresEcwKey) {
      setError('Configure EHR_JWT_PRIVATE_KEY before saving eCW settings.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/integrations/ehr/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...settings, practiceId: activePracticeId }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const startStandaloneConnect = () => {
    if (!selectedProviderId) return
    const url = apiUrl(`/api/integrations/ehr/login?providerId=${selectedProviderId}`)
    window.location.href = url
  }

  const disconnect = async () => {
    setError(null)
    const response = await fetch('/api/integrations/ehr/disconnect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: selectedProviderId, practiceId: activePracticeId }),
    })
    if (response.ok) {
      await fetchStatus()
    } else {
      const data = await response.json()
      setError(data.error || 'Failed to disconnect')
    }
  }

  const testFetchPatient = async () => {
    setTestResult(null)
    if (isBackendProvider) {
      setTestResult('Backend services connection requires API key usage. Use the backend connect endpoint.')
      return
    }
    if (!patientId) {
      setTestResult('Patient ID is required')
      return
    }
    const params = new URLSearchParams()
    params.set('providerId', selectedProviderId)
    params.set('patientId', patientId)
    if (activePracticeId) params.set('practiceId', activePracticeId)
    const response = await fetch(`/api/integrations/ehr/test/patient?${params.toString()}`)
    const data = await response.json()
    if (!response.ok) {
      setTestResult(data.error || 'Failed to fetch patient')
      return
    }
    setTestResult(`Fetched patient: ${data.patient?.id || 'unknown'}`)
  }

  const testCreateNote = async () => {
    setNoteResult(null)
    if (isBackendProvider) {
      setNoteResult('Backend services connection requires API key usage. Use the backend connect endpoint.')
      return
    }
    if (!notePatientId || !noteText) {
      setNoteResult('Patient ID and note text are required')
      return
    }
    const response = await fetch('/api/integrations/ehr/test/note', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerId: selectedProviderId,
        patientId: notePatientId,
        noteText,
        requireBinary,
        practiceId: activePracticeId,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setNoteResult(data.error || 'Failed to create note')
      return
    }
    setNoteResult(`Draft note created: ${data.id || 'unknown id'}`)
  }

  const startBulkExport = async () => {
    setBulkResult(null)
    const bulkConfig = settings.providerConfigs?.[selectedProviderId] || {}
    const orgId = bulkConfig.orgId
    const groupId = bulkConfig.groupId
    if (!orgId || !groupId) {
      setBulkResult('Configure org ID and group ID in provider settings first.')
      return
    }
    const response = await fetch('/api/integrations/ehr/bulk/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerId: selectedProviderId,
        practiceId: activePracticeId,
        orgId,
        groupId,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setBulkResult(data.error || 'Failed to start bulk export')
      return
    }
    setBulkResult(data.message || 'Bulk export started')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-gray-500">Loading EHR integration settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">EHR Integrations</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Configure SMART on FHIR connections per provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!practiceId && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Select practice</label>
              <select
                className="w-full rounded border border-gray-200 p-2 text-sm"
                value={selectedPracticeId}
                onChange={(event) => setSelectedPracticeId(event.target.value)}
              >
                {practices.map((practice) => (
                  <option key={practice.id} value={practice.id}>
                    {practice.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Select EHR</label>
            <select
              className="w-full rounded border border-gray-200 p-2 text-sm"
              value={selectedProviderId}
              onChange={(event) => setSelectedProviderId(event.target.value)}
            >
              {resolvedProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.displayName}
                </option>
              ))}
            </select>
          </div>
          {selectedProvider && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Enable provider</p>
                  <p className="text-xs text-gray-500">{selectedProvider.description}</p>
                </div>
                <Switch
                  checked={settings.enabledProviders.includes(selectedProviderId)}
                  onCheckedChange={toggleProviderEnabled}
                className="shrink-0"
                />
              </div>
              {isEcwProvider &&
                settings.enabledProviders.includes(selectedProviderId) &&
                !privateKeyJwtConfigured && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    eCW requires a JWKS URL for client authentication. Configure
                    <span className="font-semibold"> EHR_JWT_PRIVATE_KEY</span> and optionally
                    <span className="font-semibold"> EHR_JWT_KEY_ID</span>. Then use this JWKS
                    URL:
                    <div className="mt-1 break-all text-amber-900">
                      {origin
                        ? `${origin}/api/integrations/ehr/jwks`
                        : '/api/integrations/ehr/jwks'}
                    </div>
                  </div>
                )}
              <div className="grid gap-3">
                {selectedProvider.uiFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        className="w-full rounded border border-gray-200 p-2 text-sm"
                        value={settings.providerConfigs?.[selectedProviderId]?.[field.id] || ''}
                        onChange={(event) => updateProviderConfig(field.id, event.target.value)}
                      >
                        <option value="" disabled>
                          Select an option
                        </option>
                        {(field.options || []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <Switch
                        checked={Boolean(
                          settings.providerConfigs?.[selectedProviderId]?.[field.id]
                        )}
                        onCheckedChange={(checked) => updateProviderConfig(field.id, checked)}
                        className="shrink-0"
                      />
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={settings.providerConfigs?.[selectedProviderId]?.[field.id] || ''}
                        onChange={(event) => updateProviderConfig(field.id, event.target.value)}
                      />
                    )}
                    {field.helpText && (
                      <p className="text-xs text-gray-500">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="grid gap-3 md:grid-cols-4">
            <div className="flex items-center justify-between rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Enable write</p>
                <p className="text-xs text-gray-500">Global write flag.</p>
              </div>
              <Switch
                checked={settings.enableWrite || false}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableWrite: checked }))
                }
                className="shrink-0"
              />
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Patient create</p>
                <p className="text-xs text-gray-500">Requires Patient.write.</p>
              </div>
              <Switch
                checked={settings.enablePatientCreate || false}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enablePatientCreate: checked }))
                }
                className="shrink-0"
              />
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Draft note create</p>
                <p className="text-xs text-gray-500">Requires DocumentReference.write.</p>
              </div>
              <Switch
                checked={settings.enableNoteCreate || false}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableNoteCreate: checked }))
                }
                className="shrink-0"
              />
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Bulk export</p>
                <p className="text-xs text-gray-500">Enable bulk exports.</p>
              </div>
              <Switch
                checked={settings.enableBulkExport || false}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableBulkExport: checked }))
                }
                className="shrink-0"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSettings} disabled={saving || requiresEcwKey}>
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
            {!isBackendProvider && (
              <Button variant="outline" onClick={startStandaloneConnect}>
                Standalone connect
              </Button>
            )}
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
          {!isBackendProvider ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              <p className="font-medium text-gray-700">EHR Launch URL</p>
              <p className="break-all">
                {origin
                  ? `${origin}/api/integrations/ehr/launch?providerId=${selectedProviderId}`
                  : `/api/integrations/ehr/launch?providerId=${selectedProviderId}`}
              </p>
              <p className="mt-1">
                Configure this as the SMART launch URL in your EHR app registry.
              </p>
            </div>
          ) : (
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              Backend services connection uses the backend connect endpoint.
              <div className="mt-1 break-all text-blue-900">
                {origin ? `${origin}/api/integrations/ehr/backend/connect` : '/api/integrations/ehr/backend/connect'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">EHR App Status</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Connection status for all three eCW apps in this practice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {['ecw', 'ecw_bulk', 'ecw_write'].map((providerId) => {
            const display =
              providerId === 'ecw'
                ? 'SMART App Launch'
                : providerId === 'ecw_bulk'
                  ? 'Backend Bulk Read'
                  : 'Backend Write'
            const statusInfo = renderEcwStatus(providerId)
            return (
              <div key={providerId} className="flex items-center justify-between rounded border border-gray-200 p-3">
                <div>
                  <div className="text-sm font-medium text-gray-700">{display}</div>
                  <div className="text-xs text-gray-500">{providerId}</div>
                </div>
                <span className={`rounded border px-2 py-1 text-xs font-medium ${statusInfo.tone}`}>
                  {statusInfo.label}
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Connection status</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Current SMART connection details and capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {status?.connected ? (
            <>
              <div>Status: {status.status}</div>
              <div>Issuer: {status.issuer}</div>
              <div>FHIR Base: {status.fhirBaseUrl}</div>
              <div>Scopes: {status.scopes}</div>
              {status.capabilitiesSummary && (
                <div>
                  <p className="font-medium text-gray-700">Capabilities</p>
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">
                    {JSON.stringify(status.capabilitiesSummary, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500">Not connected</div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Test patient fetch</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Validate patient read access for the current connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Patient ID"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <Button onClick={testFetchPatient} disabled={isBackendProvider}>
            Fetch patient by ID
          </Button>
          {testResult && <div className="text-sm text-gray-700">{testResult}</div>}
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Create draft note</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Creates a draft DocumentReference in the EHR (never finalizes).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Patient ID"
            value={notePatientId}
            onChange={(e) => setNotePatientId(e.target.value)}
          />
          <Textarea
            placeholder="Draft note text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Switch checked={requireBinary} onCheckedChange={setRequireBinary} />
            <span className="text-sm text-gray-600">Use Binary attachment</span>
          </div>
          <Button onClick={testCreateNote} disabled={isBackendProvider}>
            Create draft note
          </Button>
          {noteResult && <div className="text-sm text-gray-700">{noteResult}</div>}
        </CardContent>
      </Card>

      {selectedProvider?.supportsBulkExport && (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Bulk export</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Start a bulk FHIR export for backfill and sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
              <div>Org ID: {settings.providerConfigs?.[selectedProviderId]?.orgId || 'Not set'}</div>
              <div>Group ID: {settings.providerConfigs?.[selectedProviderId]?.groupId || 'Not set'}</div>
            </div>
            <Button onClick={startBulkExport}>Start bulk export</Button>
            {bulkResult && <div className="text-sm text-gray-700">{bulkResult}</div>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
