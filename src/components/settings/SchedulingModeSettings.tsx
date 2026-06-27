'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CalendarClock } from 'lucide-react'
import type { SchedulingMode } from '@/lib/integrations/clinical-system/types'

interface SchedulingModeSettingsProps {
  practiceId: string
  /** Whether Open Dental is the selected clinical system (enables EHR-native scheduling). */
  openDentalAvailable: boolean
}

interface ProviderOption {
  provNum: number
  name: string
}
interface OperatoryOption {
  operatoryNum: number
  name: string
}

const LENGTH_OPTIONS = [15, 20, 30, 40, 45, 60, 90]
const NONE = 'none'

export function SchedulingModeSettings({ practiceId, openDentalAvailable }: SchedulingModeSettingsProps) {
  const [mode, setMode] = useState<SchedulingMode>('cal')
  const [defaultProvNum, setDefaultProvNum] = useState<string>(NONE)
  const [defaultOperatoryNum, setDefaultOperatoryNum] = useState<string>(NONE)
  const [defaultLengthMinutes, setDefaultLengthMinutes] = useState<number>(30)
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [operatories, setOperatories] = useState<OperatoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLists, setLoadingLists] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const withPractice = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}practiceId=${encodeURIComponent(practiceId)}`

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(withPractice('/api/settings/clinical-system'))
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load scheduling settings')
        const sched = data.settings?.scheduling
        if (sched) {
          setMode(sched.mode ?? 'cal')
          setDefaultProvNum(sched.defaultProvNum ? String(sched.defaultProvNum) : NONE)
          setDefaultOperatoryNum(sched.defaultOperatoryNum ? String(sched.defaultOperatoryNum) : NONE)
          setDefaultLengthMinutes(sched.defaultLengthMinutes ?? 30)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scheduling settings')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId])

  const loadLists = useCallback(async () => {
    setLoadingLists(true)
    try {
      const [pRes, oRes] = await Promise.all([
        fetch(withPractice('/api/integrations/opendental/providers')),
        fetch(withPractice('/api/integrations/opendental/operatories')),
      ])
      const pData = await pRes.json()
      const oData = await oRes.json()
      if (pRes.ok) setProviders((pData.providers || []).filter((p: any) => !p.isHidden))
      if (oRes.ok) setOperatories((oData.operatories || []).filter((o: any) => !o.isHidden))
    } catch {
      // Non-fatal — admin can still pick a mode without defaults.
    } finally {
      setLoadingLists(false)
    }
  }, [practiceId])

  useEffect(() => {
    if (mode === 'open_dental' && openDentalAvailable && providers.length === 0 && operatories.length === 0) {
      loadLists()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, openDentalAvailable])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const scheduling =
        mode === 'open_dental'
          ? {
              mode,
              defaultProvNum: defaultProvNum !== NONE ? Number(defaultProvNum) : null,
              defaultOperatoryNum: defaultOperatoryNum !== NONE ? Number(defaultOperatoryNum) : null,
              defaultLengthMinutes,
            }
          : { mode }
      const res = await fetch('/api/settings/clinical-system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, scheduling }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save scheduling settings')
      setSuccess('Scheduling settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scheduling settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <CalendarClock className="h-5 w-5 text-gray-400" />
          Scheduling
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Choose how this practice books appointments. Cal.com uses event types and availability;
          Open Dental pulls open slots from the practice schedule and books directly into Open Dental.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading scheduling settings...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="scheduling-mode" className="text-sm font-medium text-gray-700">
                Scheduling source
              </label>
              <Select value={mode} onValueChange={(v) => setMode(v as SchedulingMode)}>
                <SelectTrigger id="scheduling-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cal">Cal.com scheduling</SelectItem>
                  <SelectItem value="open_dental" disabled={!openDentalAvailable}>
                    Open Dental scheduling{!openDentalAvailable ? ' (requires Open Dental)' : ''}
                  </SelectItem>
                </SelectContent>
              </Select>
              {!openDentalAvailable && (
                <p className="text-xs text-gray-500">
                  Set the clinical system to Open Dental above to enable EHR-native scheduling.
                </p>
              )}
            </div>

            {mode === 'open_dental' && (
              <div className="space-y-4 rounded-md border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-700">Open Dental booking defaults</p>
                {loadingLists ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading providers and operatories...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Default provider</label>
                      <Select value={defaultProvNum} onValueChange={setDefaultProvNum}>
                        <SelectTrigger>
                          <SelectValue placeholder="Practice default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Practice default</SelectItem>
                          {providers.map((p) => (
                            <SelectItem key={p.provNum} value={String(p.provNum)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Default operatory</label>
                      <Select value={defaultOperatoryNum} onValueChange={setDefaultOperatoryNum}>
                        <SelectTrigger>
                          <SelectValue placeholder="Auto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Auto (first available)</SelectItem>
                          {operatories.map((o) => (
                            <SelectItem key={o.operatoryNum} value={String(o.operatoryNum)}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Default length</label>
                      <Select
                        value={String(defaultLengthMinutes)}
                        onValueChange={(v) => setDefaultLengthMinutes(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LENGTH_OPTIONS.map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {m} minutes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}
            {success && <div className="text-sm text-green-700">{success}</div>}

            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save scheduling settings'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
