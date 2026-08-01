'use client'

import { useEffect, useMemo, useState } from 'react'
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

interface PebbleIndexSettingsProps {
  practiceId?: string
}

type PracticeUser = {
  id: string
  name: string
  email: string
  role: string
}

type PebbleCredential = {
  id: string
  practiceId: string
  providerUserId: string
  activeSessionId: string | null
  isActive: boolean
  hasWebhookSecret: boolean
  provider?: { id: string; name: string; email: string } | null
}

function buildApiUrl(practiceId?: string) {
  const base = '/api/settings/pebble'
  if (!practiceId) return base
  return `${base}?practiceId=${encodeURIComponent(practiceId)}`
}

export function PebbleIndexSettings({ practiceId }: PebbleIndexSettingsProps) {
  const apiUrl = useMemo(() => buildApiUrl(practiceId), [practiceId])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [integrations, setIntegrations] = useState<PebbleCredential[]>([])
  const [users, setUsers] = useState<PracticeUser[]>([])
  const [newProviderUserId, setNewProviderUserId] = useState('')
  const [revealedById, setRevealedById] = useState<Record<string, string>>({})

  const configuredProviderIds = useMemo(
    () => new Set(integrations.map((row) => row.providerUserId)),
    [integrations]
  )
  const availableUsers = users.filter((u) => !configuredProviderIds.has(u.id))

  const load = async () => {
    if (!practiceId) return
    setLoading(true)
    setError('')
    try {
      const [pebbleRes, usersRes] = await Promise.all([
        fetch(apiUrl),
        fetch(`/api/users?practiceId=${encodeURIComponent(practiceId)}`),
      ])
      const pebbleData = await pebbleRes.json()
      if (!pebbleRes.ok) throw new Error(pebbleData.error || 'Failed to load Pebble settings')

      setWebhookUrl(pebbleData.webhookUrl || '')
      setIntegrations(Array.isArray(pebbleData.integrations) ? pebbleData.integrations : [])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(Array.isArray(usersData.users) ? usersData.users : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Pebble settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [apiUrl, practiceId])

  const postAction = async (payload: Record<string, unknown>, successMsg: string) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save')

      if (data.webhookUrl) setWebhookUrl(data.webhookUrl)

      if (payload.action === 'delete') {
        await load()
      } else if (data.integration) {
        setIntegrations((prev) => {
          const next = prev.filter((row) => row.id !== data.integration.id)
          return [...next, data.integration].sort((a, b) =>
            (a.provider?.name || '').localeCompare(b.provider?.name || '')
          )
        })
        if (data.revealedSecret) {
          setRevealedById((prev) => ({ ...prev, [data.integration.id]: data.revealedSecret }))
        }
        if (payload.action === 'create') {
          setNewProviderUserId('')
          await load()
        }
      }

      setSuccess(successMsg)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setSuccess('Copied to clipboard')
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle>Pebble Index 01 — Aria dictation</CardTitle>
        <CardDescription>
          Create one webhook secret per clinician. Each doctor pastes their own secret into their
          Pebble app so ring dictation lands on their Aria sessions only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Webhook URL (same for every clinician)</Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              disabled={!webhookUrl}
              onClick={() => void copy(webhookUrl)}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            In Pebble: Send = Recording + Transcription, Trigger = Double click &amp; hold, Header ={' '}
            <span className="font-mono">Authorization: Bearer &lt;secret&gt;</span>
          </p>
        </div>

        <div className="space-y-3">
          <Label>Clinician ring credentials</Label>
          {integrations.length === 0 ? (
            <p className="text-sm text-gray-600">
              No ring credentials yet. Add a clinician below to generate their secret.
            </p>
          ) : (
            integrations.map((row) => {
              const revealed = revealedById[row.id]
              const label = row.provider
                ? `${row.provider.name} (${row.provider.email})`
                : row.providerUserId
              return (
                <div
                  key={row.id}
                  className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">
                        {row.hasWebhookSecret ? 'Secret configured' : 'No secret'}
                        {row.activeSessionId
                          ? ` · Active session ${row.activeSessionId.slice(0, 8)}…`
                          : ' · No active Aria session'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`pebble-active-${row.id}`} className="text-xs text-gray-600">
                        Enabled
                      </Label>
                      <Switch
                        id={`pebble-active-${row.id}`}
                        checked={row.isActive}
                        disabled={loading || saving}
                        onCheckedChange={(checked) => {
                          void postAction(
                            { action: 'update', id: row.id, isActive: checked },
                            checked ? 'Credential enabled.' : 'Credential disabled.'
                          )
                        }}
                      />
                    </div>
                  </div>

                  {revealed ? (
                    <div className="flex gap-2">
                      <Input readOnly value={revealed} className="font-mono text-xs" />
                      <Button type="button" variant="outline" onClick={() => void copy(revealed)}>
                        Copy
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        void postAction(
                          { action: 'rotate', id: row.id },
                          'New secret generated. Copy it into this clinician\'s Pebble app now.'
                        )
                      }
                    >
                      Rotate secret
                    </Button>
                    {row.activeSessionId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          void postAction(
                            { action: 'clearActiveSession', id: row.id },
                            'Active session cleared.'
                          )
                        }
                      >
                        Clear session
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Delete this clinician's Index ring credential? Their Pebble webhook will stop working."
                          )
                        ) {
                          return
                        }
                        void postAction({ action: 'delete', id: row.id }, 'Credential deleted.')
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <Label>Add clinician ring</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={newProviderUserId || undefined}
              onValueChange={setNewProviderUserId}
              disabled={loading || saving || !practiceId || availableUsers.length === 0}
            >
              <SelectTrigger className="sm:flex-1">
                <SelectValue
                  placeholder={
                    availableUsers.length === 0
                      ? 'All clinicians already have credentials'
                      : 'Select clinician'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              disabled={loading || saving || !practiceId || !newProviderUserId}
              onClick={() =>
                void postAction(
                  { action: 'create', providerUserId: newProviderUserId },
                  "Credential created. Copy the secret into that clinician's Pebble app now."
                )
              }
            >
              Generate secret
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-700">{success}</p> : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
