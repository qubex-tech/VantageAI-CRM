'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

type Environment = 'sandbox' | 'production'

type Connection = {
  environment: Environment
  subdomain: string
  locationId: number
  locationName?: string | null
  status: string
  isActive: boolean
  lastSuccessfulSyncAt?: string | null
  lastSyncStatus?: string | null
  lastSyncError?: string | null
  syncReadStatus?: string | null
  syncWriteStatus?: string | null
}

type Institution = {
  id: number
  name?: string | null
  subdomain: string
  locations: Array<{ id: number; name?: string | null }>
}

interface NexHealthSettingsProps {
  practiceId: string
}

export function NexHealthSettings({ practiceId }: NexHealthSettingsProps) {
  const apiUrl = (path: string) => {
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}practiceId=${encodeURIComponent(practiceId)}`
  }

  const [connection, setConnection] = useState<Connection | null>(null)
  const [environment, setEnvironment] = useState<Environment>('sandbox')
  const [sandboxKeyConfigured, setSandboxKeyConfigured] = useState(false)
  const [productionKeyConfigured, setProductionKeyConfigured] = useState(false)
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingInstitutions, setLoadingInstitutions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [syncResult, setSyncResult] = useState('')

  const keyReady = environment === 'production' ? productionKeyConfigured : sandboxKeyConfigured

  const load = async () => {
    const response = await fetch(apiUrl('/api/integrations/nexhealth/config'))
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to load NexHealth')
    const next = (data.connection as Connection | null) ?? null
    setConnection(next)
    setSandboxKeyConfigured(Boolean(data.sandboxKeyConfigured))
    setProductionKeyConfigured(Boolean(data.productionKeyConfigured))
    if (next?.environment) setEnvironment(next.environment)
    if (next) setSelectedLocation(`${next.subdomain}:${next.locationId}`)
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load NexHealth')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [practiceId])

  const loadInstitutions = async () => {
    setLoadingInstitutions(true)
    setError('')
    try {
      const response = await fetch(apiUrl(`/api/integrations/nexhealth/institutions?environment=${environment}`))
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load institutions')
      setInstitutions(data.institutions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load institutions')
    } finally {
      setLoadingInstitutions(false)
    }
  }

  const handleConnect = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const [subdomain, locationIdRaw] = selectedLocation.split(':')
      const locationId = Number(locationIdRaw)
      const institution = institutions.find((row) => row.subdomain === subdomain)
      const location = institution?.locations.find((row) => row.id === locationId)
      if (!institution || !location) {
        throw new Error('Choose a NexHealth location')
      }
      const response = await fetch('/api/integrations/nexhealth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          environment,
          subdomain: institution.subdomain,
          institutionId: institution.id,
          locationId: location.id,
          locationName: location.name || institution.name,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to connect NexHealth')
      setConnection(data.connection)
      const warning = Array.isArray(data.webhookWarnings) && data.webhookWarnings.length
        ? ` Webhooks: ${data.webhookWarnings.join('; ')}`
        : ''
      setSuccess(`NexHealth location saved.${warning}`)
      setSyncing(true)
      const syncResponse = await fetch('/api/integrations/nexhealth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      })
      const syncData = await syncResponse.json()
      if (!syncResponse.ok) throw new Error(syncData.error || 'Initial sync failed')
      setSyncResult(
        `Patients ${syncData.patients?.fetched ?? 0}, appointments ${syncData.appointments?.fetched ?? 0} (${syncData.status}).`
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect NexHealth')
    } finally {
      setSaving(false)
      setSyncing(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    setSyncResult('')
    try {
      const response = await fetch('/api/integrations/nexhealth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.errorSamples || 'Sync failed')
      setSyncResult(
        `Patients ${data.patients?.fetched ?? 0} (created ${data.patients?.created ?? 0}), appointments ${data.appointments?.fetched ?? 0} (${data.status}).`
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(apiUrl('/api/integrations/nexhealth/config'), { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to disconnect')
      setConnection(null)
      setSelectedLocation('')
      setSuccess('NexHealth disconnected.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  const locationOptions = institutions.flatMap((institution) =>
    institution.locations.map((location) => ({
      value: `${institution.subdomain}:${location.id}`,
      label: `${institution.name || institution.subdomain} — ${location.name || `Location ${location.id}`}`,
    }))
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading NexHealth...
      </div>
    )
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">NexHealth</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Link one NexHealth location. Patients and the schedule sync into this practice. The API key
          is the Vantage developer key (`NEXHEALTH_SANDBOX_API_KEY` or `NEXHEALTH_API_KEY`), not a
          per-practice secret.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!keyReady && (
          <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 p-3">
            {environment === 'production' ? 'NEXHEALTH_API_KEY' : 'NEXHEALTH_SANDBOX_API_KEY'} is not
            set in the environment, so institutions cannot be loaded yet.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Environment</label>
            <Select value={environment} onValueChange={(value) => setEnvironment(value as Environment)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Location</label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={loadInstitutions} disabled={loadingInstitutions || !keyReady}>
                {loadingInstitutions ? 'Loading...' : 'Load locations'}
              </Button>
            </div>
          </div>
        </div>

        {locationOptions.length > 0 && (
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger>
              <SelectValue placeholder="Select a location" />
            </SelectTrigger>
            <SelectContent>
              {locationOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {connection?.isActive && (
          <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 space-y-1">
            <p>
              Connected to <span className="font-medium">{connection.locationName || connection.subdomain}</span>{' '}
              ({connection.environment}, location {connection.locationId})
            </p>
            <p>
              Last sync: {connection.lastSuccessfulSyncAt ? new Date(connection.lastSuccessfulSyncAt).toLocaleString() : 'never'}
              {connection.lastSyncStatus ? ` · ${connection.lastSyncStatus}` : ''}
            </p>
            <p>
              Synchronizer read {connection.syncReadStatus || 'unknown'}, write {connection.syncWriteStatus || 'unknown'}
            </p>
            {connection.lastSyncError && <p className="text-amber-800">{connection.lastSyncError}</p>}
          </div>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}
        {success && <div className="text-sm text-green-700">{success}</div>}
        {syncResult && <div className="text-sm text-gray-700">{syncResult}</div>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleConnect} disabled={saving || syncing || !selectedLocation}>
            {saving || syncing ? 'Connecting...' : 'Save and sync'}
          </Button>
          {connection?.isActive && (
            <>
              <Button type="button" variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync now'}
              </Button>
              <Button type="button" variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
