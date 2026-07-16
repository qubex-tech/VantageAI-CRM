'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_HOURS_OF_OPERATION,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  type HoursOfOperationSettings,
  type WeekdayKey,
} from '@/lib/practice-hours/types'
import { NORTH_AMERICA_TIMEZONE_OPTIONS } from '@/lib/timezone'

interface HoursOfOperationSettingsProps {
  practiceId?: string
}

function buildApiUrl(practiceId?: string) {
  const base = '/api/settings/hours-of-operation'
  if (!practiceId) return base
  return `${base}?practiceId=${encodeURIComponent(practiceId)}`
}

export function HoursOfOperationSettings({ practiceId }: HoursOfOperationSettingsProps) {
  const [settings, setSettings] = useState<HoursOfOperationSettings>(
    () => JSON.parse(JSON.stringify(DEFAULT_HOURS_OF_OPERATION)) as HoursOfOperationSettings
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const apiUrl = useMemo(() => buildApiUrl(practiceId), [practiceId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(apiUrl)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setSettings(data.settings || DEFAULT_HOURS_OF_OPERATION)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl])

  const updateDay = (key: WeekdayKey, patch: Partial<HoursOfOperationSettings['days'][WeekdayKey]>) => {
    setSettings((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [key]: { ...prev.days[key], ...patch },
      },
    }))
    setSuccess('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/settings/hours-of-operation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          settings,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save')
      }
      setSettings(data.settings)
      setSuccess('Hours of operation saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours of operation</CardTitle>
        <CardDescription>
          Set the practice timezone, open hours, and lunch window. Open/close times are in this
          timezone. Voice booking and Slot Fill use it so callers hear local times—not UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            <div className="space-y-1 max-w-md">
              <Label className="text-sm font-medium text-gray-900">Practice timezone</Label>
              <select
                className="w-full rounded border border-gray-200 p-2 text-sm"
                value={settings.timezone}
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, timezone: e.target.value }))
                  setSuccess('')
                }}
              >
                {!NORTH_AMERICA_TIMEZONE_OPTIONS.some((z) => z.value === settings.timezone) && (
                  <option value={settings.timezone}>{settings.timezone}</option>
                )}
                {NORTH_AMERICA_TIMEZONE_OPTIONS.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                Used for hours below, voice appointment offers, and Open Dental scheduling.
              </p>
            </div>

            <div className="space-y-3">
              {WEEKDAY_KEYS.map((key) => {
                const day = settings.days[key]
                return (
                  <div
                    key={key}
                    className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-center border border-gray-100 rounded-lg px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(checked) => updateDay(key, { enabled: checked })}
                        aria-label={`${WEEKDAY_LABELS[key]} open`}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {WEEKDAY_LABELS[key]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Open</Label>
                        <Input
                          type="time"
                          value={day.open}
                          disabled={!day.enabled}
                          onChange={(e) => updateDay(key, { open: e.target.value })}
                          className="w-[130px]"
                        />
                      </div>
                      <span className="text-gray-400 mt-5">–</span>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Close</Label>
                        <Input
                          type="time"
                          value={day.close}
                          disabled={!day.enabled}
                          onChange={(e) => updateDay(key, { close: e.target.value })}
                          className="w-[130px]"
                        />
                      </div>
                      {!day.enabled && (
                        <span className="text-xs text-gray-500 mt-5">Closed</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Lunch time</p>
                  <p className="text-xs text-gray-500">
                    Times during lunch are unavailable for Slot Fill offers.
                  </p>
                </div>
                <Switch
                  checked={settings.lunch.enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      lunch: { ...prev.lunch, enabled: checked },
                    }))
                  }
                  aria-label="Enable lunch time"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Start</Label>
                  <Input
                    type="time"
                    value={settings.lunch.start}
                    disabled={!settings.lunch.enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        lunch: { ...prev.lunch, start: e.target.value },
                      }))
                    }
                    className="w-[130px]"
                  />
                </div>
                <span className="text-gray-400 mt-5">–</span>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">End</Label>
                  <Input
                    type="time"
                    value={settings.lunch.end}
                    disabled={!settings.lunch.enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        lunch: { ...prev.lunch, end: e.target.value },
                      }))
                    }
                    className="w-[130px]"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || loading}>
                {saving ? 'Saving…' : 'Save hours'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
