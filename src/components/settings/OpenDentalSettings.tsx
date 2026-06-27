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

type OpenDentalConnection = {
  id: string
  displayName: string
  apiMode: string
  baseUrl: string
  status: string
  isActive: boolean
  lastHealthCheckAt?: string | null
  lastSuccessfulSyncAt?: string | null
  lastSyncStatus?: string | null
  lastSyncError?: string | null
  odVersion?: string | null
  hasCustomerKey?: boolean
}

interface OpenDentalSettingsProps {
  practiceId: string
}

export function OpenDentalSettings({ practiceId }: OpenDentalSettingsProps) {
  const apiUrl = (path: string) => {
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}practiceId=${encodeURIComponent(practiceId)}`
  }

  const [connection, setConnection] = useState<OpenDentalConnection | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [customerKey, setCustomerKey] = useState('')
  const [apiMode, setApiMode] = useState<'remote' | 'service' | 'local'>('remote')
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [healthChecking, setHealthChecking] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingAppointments, setSyncingAppointments] = useState(false)
  const [writingBack, setWritingBack] = useState(false)
  const [writebackPatNum, setWritebackPatNum] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [appointmentSyncResult, setAppointmentSyncResult] = useState<string | null>(null)
  const [writebackResult, setWritebackResult] = useState<string | null>(null)

  const hasCustomerKey = Boolean(connection?.hasCustomerKey)

  const loadConnection = async () => {
    const response = await fetch(apiUrl('/api/integrations/opendental/config'))
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Failed to load Open Dental configuration')
    }
    const data = await response.json()
    const next = data.connection as OpenDentalConnection | null
    setConnection(next)
    if (next) {
      setDisplayName(next.displayName || '')
      setApiMode((next.apiMode as 'remote' | 'service' | 'local') || 'remote')
      setBaseUrl(next.baseUrl || '')
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        await loadConnection()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Open Dental settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [practiceId])

  const handleSaveConfig = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      if (!displayName.trim()) {
        throw new Error('Display name is required')
      }
      if (!hasCustomerKey && !customerKey.trim()) {
        throw new Error('Customer key is required for a new connection')
      }

      const response = await fetch('/api/integrations/opendental/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          displayName: displayName.trim(),
          ...(customerKey.trim() ? { customerKey: customerKey.trim() } : {}),
          apiMode,
          ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save Open Dental configuration')
      }

      const data = await response.json()
      setConnection(data.connection)
      setCustomerKey('')
      setSuccess('Configuration saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleConnect = async () => {
    setError('')
    setSuccess('')
    setConnecting(true)

    try {
      if (!displayName.trim() || !customerKey.trim()) {
        throw new Error('Display name and customer key are required to connect')
      }

      const response = await fetch('/api/integrations/opendental/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          displayName: displayName.trim(),
          customerKey: customerKey.trim(),
          apiMode,
          ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to connect Open Dental')
      }

      const data = await response.json()
      setConnection(data.connection)
      setCustomerKey('')
      setSuccess('Connected and validated successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  const handleHealthCheck = async () => {
    setError('')
    setSuccess('')
    setHealthChecking(true)

    try {
      const response = await fetch('/api/integrations/opendental/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Health check failed')
      }

      await loadConnection()
      setSuccess('Health check completed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed')
    } finally {
      setHealthChecking(false)
    }
  }

  const handleTest = async () => {
    setError('')
    setTestResult(null)
    setTesting(true)

    try {
      const response = await fetch(apiUrl('/api/integrations/opendental/test'))
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Smoke test failed')
      }
      setTestResult(
        `OK — preferences: ${data.preferencesCount ?? 0}, clinics: ${data.clinicsCount ?? 0}`
      )
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Smoke test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSyncPatients = async () => {
    setError('')
    setSuccess('')
    setSyncResult(null)
    setSyncing(true)

    try {
      const response = await fetch('/api/integrations/opendental/sync/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      })

      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Patient sync failed')
      }

      const s = data.summary
      setSyncResult(
        `Synced ${s.fetched} patient(s) — created ${s.created}, updated ${s.updated}, linked ${s.linked}, errors ${s.errors}.`
      )
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : 'Patient sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAppointments = async () => {
    setError('')
    setSuccess('')
    setAppointmentSyncResult(null)
    setSyncingAppointments(true)

    try {
      const response = await fetch('/api/integrations/opendental/sync/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      })

      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Appointment sync failed')
      }

      const s = data.summary
      setAppointmentSyncResult(
        `Synced ${s.fetched} appointment(s) — created ${s.created}, updated ${s.updated}, skipped ${s.skipped}, errors ${s.errors}.`
      )
    } catch (err) {
      setAppointmentSyncResult(err instanceof Error ? err.message : 'Appointment sync failed')
    } finally {
      setSyncingAppointments(false)
    }
  }

  const handleTestWriteback = async () => {
    setError('')
    setSuccess('')
    setWritebackResult(null)

    const patNum = Number(writebackPatNum.trim())
    if (!Number.isInteger(patNum) || patNum <= 0) {
      setWritebackResult('Enter a valid Open Dental PatNum to test writeback.')
      return
    }

    setWritingBack(true)
    try {
      const response = await fetch('/api/integrations/opendental/writeback/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, patNum }),
      })

      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Test writeback failed')
      }

      setWritebackResult(
        `Wrote test commlog to PatNum ${patNum}${data.commlogNum ? ` (CommlogNum ${data.commlogNum})` : ''}.`
      )
    } catch (err) {
      setWritebackResult(err instanceof Error ? err.message : 'Test writeback failed')
    } finally {
      setWritingBack(false)
    }
  }

  const handleDisconnect = async () => {
    setError('')
    setSuccess('')
    setDisconnecting(true)

    try {
      const response = await fetch('/api/integrations/opendental/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to disconnect')
      }

      await loadConnection()
      setSuccess('Open Dental integration disabled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">Loading Open Dental settings...</div>
    )
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Open Dental connection</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Connect using your practice customer key. The platform developer key is configured globally.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveConfig} className="space-y-4">
          {connection && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p>
                Status:{' '}
                <span className="font-medium">
                  {connection.isActive ? connection.status : 'disabled'}
                </span>
              </p>
              {connection.odVersion && <p className="mt-1">Open Dental version: {connection.odVersion}</p>}
              {connection.lastSyncError && (
                <p className="mt-1 text-red-700">Last error: {connection.lastSyncError}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="odDisplayName">Display name</Label>
            <Input
              id="odDisplayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Main office"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="odCustomerKey">Customer key</Label>
            <Input
              id="odCustomerKey"
              type="password"
              value={customerKey}
              onChange={(e) => setCustomerKey(e.target.value)}
              placeholder={hasCustomerKey ? '•••••••• (leave blank to keep existing)' : 'From Open Dental API setup'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="odApiMode">API mode</Label>
            <Select value={apiMode} onValueChange={(value) => setApiMode(value as typeof apiMode)}>
              <SelectTrigger id="odApiMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remote">Remote (hosted API)</SelectItem>
                <SelectItem value="service">Service (on-premise service)</SelectItem>
                <SelectItem value="local">Local</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="odBaseUrl">Base URL (optional)</Label>
            <Input
              id="odBaseUrl"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.opendental.com/api/v1"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">{success}</div>
          )}
          {testResult && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {testResult}
            </div>
          )}
          {syncResult && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {syncResult}
            </div>
          )}
          {appointmentSyncResult && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {appointmentSyncResult}
            </div>
          )}
          {writebackResult && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {writebackResult}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save configuration'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleConnect}
              disabled={connecting || !customerKey.trim()}
            >
              {connecting ? 'Connecting...' : 'Connect & validate'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleHealthCheck}
              disabled={healthChecking || !connection?.isActive}
            >
              {healthChecking ? 'Checking...' : 'Run health check'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || !connection?.isActive}
            >
              {testing ? 'Testing...' : 'Smoke test'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSyncPatients}
              disabled={syncing || !connection?.isActive}
            >
              {syncing ? 'Syncing patients...' : 'Sync patients'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSyncAppointments}
              disabled={syncingAppointments || !connection?.isActive}
            >
              {syncingAppointments ? 'Syncing appointments...' : 'Sync appointments'}
            </Button>
            {connection?.isActive && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            )}
          </div>

          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            <Label htmlFor="odWritebackPatNum">Test writeback (commlog)</Label>
            <p className="text-xs text-gray-500">
              Verify call note writeback by posting a test commlog to an Open Dental patient. Enter a
              PatNum, then click Test writeback.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="odWritebackPatNum"
                value={writebackPatNum}
                onChange={(e) => setWritebackPatNum(e.target.value)}
                placeholder="PatNum (e.g. 1)"
                className="max-w-[180px]"
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleTestWriteback}
                disabled={writingBack || !connection?.isActive || !writebackPatNum.trim()}
              >
                {writingBack ? 'Writing...' : 'Test writeback'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
