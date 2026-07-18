'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface AriaScribeSettingsProps {
  practiceId?: string
}

function buildApiUrl(practiceId?: string) {
  const base = '/api/settings/ai/aria'
  if (!practiceId) return base
  return `${base}?practiceId=${encodeURIComponent(practiceId)}`
}

export function AriaScribeSettings({ practiceId }: AriaScribeSettingsProps) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const apiUrl = useMemo(() => buildApiUrl(practiceId), [practiceId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load Aria settings')
      setEnabled(Boolean(data.enabled))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Aria settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [apiUrl])

  const save = async (next: boolean) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save')
      setEnabled(Boolean(data.enabled))
      setSuccess(next ? 'Aria is enabled for this practice.' : 'Aria is disabled for this practice.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setEnabled(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle>Aria — Scribe Agent</CardTitle>
        <CardDescription>
          Ambient and dictation visit notes with clinician review, then draft writeback to the EHR.
          When enabled, the Aria tab appears in the mobile app for this practice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="aria-enabled" className="text-sm font-medium text-gray-900">
              Enable Aria
            </Label>
            <p className="text-xs text-gray-500">
              Off by default. Mobile capture and scribe APIs stay unavailable until enabled.
            </p>
          </div>
          <Switch
            id="aria-enabled"
            checked={enabled}
            disabled={loading || saving || !practiceId}
            onCheckedChange={(checked) => {
              setEnabled(checked)
              void save(checked)
            }}
          />
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
