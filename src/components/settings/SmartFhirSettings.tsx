'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

type SmartFhirSettings = {
  enabled: boolean
  issuer?: string
  fhirBaseUrl?: string
  clientId?: string
  enableWrite?: boolean
  enablePatientCreate?: boolean
  enableNoteCreate?: boolean
}

type StatusResponse = {
  connected: boolean
  status?: string
  issuer?: string
  fhirBaseUrl?: string
  scopes?: string
  expiresAt?: string
  patientContext?: any
  userContext?: any
  capabilitiesSummary?: any
}

export function SmartFhirSettings() {
  const [settings, setSettings] = useState<SmartFhirSettings>({
    enabled: false,
    issuer: '',
    fhirBaseUrl: '',
    clientId: '',
    enableWrite: false,
    enablePatientCreate: false,
    enableNoteCreate: false,
  })
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

  const fetchSettings = async () => {
    const response = await fetch('/api/integrations/smart/config')
    if (response.ok) {
      const data = await response.json()
      if (data.settings) {
        setSettings({
          enabled: data.settings.enabled ?? false,
          issuer: data.settings.issuer || '',
          fhirBaseUrl: data.settings.fhirBaseUrl || '',
          clientId: data.settings.clientId || '',
          enableWrite: data.settings.enableWrite ?? false,
          enablePatientCreate: data.settings.enablePatientCreate ?? false,
          enableNoteCreate: data.settings.enableNoteCreate ?? false,
        })
      }
    }
  }

  const fetchStatus = async () => {
    const response = await fetch('/api/integrations/smart/status?includeCapabilities=1')
    if (response.ok) {
      const data = await response.json()
      setStatus(data)
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchSettings(), fetchStatus()])
      } catch (err) {
        setError('Failed to load SMART on FHIR settings')
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

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/integrations/smart/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
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
    if (!settings.issuer || !settings.clientId) {
      setError('Issuer and Client ID are required to connect')
      return
    }
    const params = new URLSearchParams({
      issuer: settings.issuer,
      clientId: settings.clientId,
    })
    if (settings.fhirBaseUrl) {
      params.set('fhirBaseUrl', settings.fhirBaseUrl)
    }
    window.location.href = `/api/integrations/smart/login?${params.toString()}`
  }

  const disconnect = async () => {
    setError(null)
    const response = await fetch('/api/integrations/smart/disconnect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issuer: status?.issuer }),
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
    if (!patientId) {
      setTestResult('Patient ID is required')
      return
    }
    const response = await fetch(
      `/api/integrations/smart/test/patient?patientId=${encodeURIComponent(patientId)}`
    )
    const data = await response.json()
    if (!response.ok) {
      setTestResult(data.error || 'Failed to fetch patient')
      return
    }
    setTestResult(`Fetched patient: ${data.patient?.id || 'unknown'}`)
  }

  const testCreateNote = async () => {
    setNoteResult(null)
    if (!notePatientId || !noteText) {
      setNoteResult('Patient ID and note text are required')
      return
    }
    const response = await fetch('/api/integrations/smart/test/note', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        patientId: notePatientId,
        noteText,
        requireBinary,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setNoteResult(data.error || 'Failed to create note')
      return
    }
    setNoteResult(`Draft note created: ${data.id || 'unknown id'}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-gray-500">Loading SMART on FHIR settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">SMART on FHIR (eCW)</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Configure SMART on FHIR connection for this practice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Enable integration</p>
              <p className="text-xs text-gray-500">Disable to block all SMART connections.</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
          <div className="grid gap-3">
            <Input
              placeholder="Issuer URL (e.g., https://fhir.epic.com/interconnect-fhir-oauth)"
              value={settings.issuer || ''}
              onChange={(e) => setSettings((prev) => ({ ...prev, issuer: e.target.value }))}
            />
            <Input
              placeholder="FHIR Base URL (optional override)"
              value={settings.fhirBaseUrl || ''}
              onChange={(e) => setSettings((prev) => ({ ...prev, fhirBaseUrl: e.target.value }))}
            />
            <Input
              placeholder="Client ID"
              value={settings.clientId || ''}
              onChange={(e) => setSettings((prev) => ({ ...prev, clientId: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center justify-between rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Enable write</p>
                <p className="text-xs text-gray-500">Global write flag still applies.</p>
              </div>
              <Switch
                checked={settings.enableWrite || false}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enableWrite: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Patient create</p>
                <p className="text-xs text-gray-500">Requires Patient.write scope.</p>
              </div>
              <Switch
                checked={settings.enablePatientCreate || false}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, enablePatientCreate: checked }))
                }
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
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
            <Button variant="outline" onClick={startStandaloneConnect}>
              Standalone connect
            </Button>
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-700">EHR Launch URL</p>
            <p className="break-all">
              {origin ? `${origin}/api/integrations/smart/launch` : '/api/integrations/smart/launch'}
            </p>
            <p className="mt-1">
              Configure this as the SMART launch URL in your EHR app registry.
            </p>
          </div>
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
          <Button onClick={testFetchPatient}>Fetch patient by ID</Button>
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
          <Button onClick={testCreateNote}>Create draft note</Button>
          {noteResult && <div className="text-sm text-gray-700">{noteResult}</div>}
        </CardContent>
      </Card>
    </div>
  )
}
