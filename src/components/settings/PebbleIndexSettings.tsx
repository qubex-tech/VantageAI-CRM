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
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [providerUserId, setProviderUserId] = useState<string>('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [users, setUsers] = useState<PracticeUser[]>([])

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
      setHasWebhookSecret(Boolean(pebbleData.integration?.hasWebhookSecret))
      setIsActive(pebbleData.integration?.isActive ?? true)
      setProviderUserId(pebbleData.integration?.providerUserId || '')
      setActiveSessionId(pebbleData.integration?.activeSessionId ?? null)

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(Array.isArray(usersData.users) ? usersData.users : Array.isArray(usersData) ? usersData : [])
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

  const save = async (payload: Record<string, unknown>, successMsg: string) => {
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

      setHasWebhookSecret(Boolean(data.integration?.hasWebhookSecret))
      setIsActive(data.integration?.isActive ?? true)
      setProviderUserId(data.integration?.providerUserId || '')
      setActiveSessionId(data.integration?.activeSessionId ?? null)
      setWebhookUrl(data.webhookUrl || webhookUrl)
      if (data.revealedSecret) {
        setRevealedSecret(data.revealedSecret)
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
          Route voice notes from the Pebble Index ring into the clinician&apos;s active Aria session
          in VantageAI. Doctors start a visit in the mobile app, then dictate on the ring.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="pebble-active" className="text-sm font-medium text-gray-900">
              Enable Index webhook
            </Label>
            <p className="text-xs text-gray-500">
              Requires Aria to be enabled for this practice.
            </p>
          </div>
          <Switch
            id="pebble-active"
            checked={isActive}
            disabled={loading || saving || !practiceId}
            onCheckedChange={(checked) => {
              setIsActive(checked)
              void save({ isActive: checked }, checked ? 'Pebble webhook enabled.' : 'Pebble webhook disabled.')
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Webhook URL</Label>
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
        </div>

        <div className="space-y-2">
          <Label>Webhook secret</Label>
          <p className="text-xs text-gray-500">
            Paste into Pebble app → Index → Webhook as{' '}
            <span className="font-mono">Authorization: Bearer &lt;secret&gt;</span>. Prefer Send:
            Both, Trigger: Double click &amp; hold.
          </p>
          {revealedSecret ? (
            <div className="flex gap-2">
              <Input readOnly value={revealedSecret} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={() => void copy(revealedSecret)}>
                Copy
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              {hasWebhookSecret
                ? 'A secret is configured. Generate a new one if you need to re-copy it.'
                : 'No secret yet — generate one to connect the ring.'}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || saving || !practiceId}
            onClick={() =>
              void save(
                { rotateSecret: true, isActive: true },
                'New webhook secret generated. Copy it into the Pebble app now — it will not be shown again.'
              )
            }
          >
            {hasWebhookSecret ? 'Rotate secret' : 'Generate secret'}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Ring dictation provider</Label>
          <p className="text-xs text-gray-500">
            Aria sessions started by this user receive Index dictation.
          </p>
          <Select
            value={providerUserId || undefined}
            onValueChange={(value) => {
              setProviderUserId(value)
              void save({ providerUserId: value }, 'Provider updated.')
            }}
            disabled={loading || saving || !practiceId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select clinician" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeSessionId ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Active Aria session bound: <span className="font-mono text-xs">{activeSessionId}</span>
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void save({ clearActiveSession: true }, 'Active session cleared.')}
              >
                Clear binding
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            No active Aria session bound. Start a visit in VantageAI mobile before dictating on the
            ring.
          </p>
        )}

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
