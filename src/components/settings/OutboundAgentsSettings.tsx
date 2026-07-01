'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { OutboundAgentsSettings } from '@/lib/appointment-optimization/types'
import {
  DEFAULT_OUTBOUND_AGENTS,
  DEFAULT_TRIGGER_SCENARIOS,
  OPEN_SLOT_TRIGGER_SCENARIO_OPTIONS,
  type OpenSlotTriggerScenario,
} from '@/lib/appointment-optimization/types'

interface OutboundAgentsSettingsProps {
  practiceId?: string
}

function buildApiUrl(practiceId?: string) {
  const base = '/api/settings/outbound-agents'
  if (!practiceId) return base
  return `${base}?practiceId=${encodeURIComponent(practiceId)}`
}

export function OutboundAgentsSettings({ practiceId }: OutboundAgentsSettingsProps) {
  const [settings, setSettings] = useState<OutboundAgentsSettings>(DEFAULT_OUTBOUND_AGENTS)
  const [loading, setLoading] = useState(false)
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
      setSettings({
        ...DEFAULT_OUTBOUND_AGENTS,
        ...data.settings,
        triggerScenarios: {
          ...DEFAULT_TRIGGER_SCENARIOS,
          ...data.settings?.triggerScenarios,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [apiUrl])

  const save = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, settings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setSettings({
        ...DEFAULT_OUTBOUND_AGENTS,
        ...data.settings,
        triggerScenarios: {
          ...DEFAULT_TRIGGER_SCENARIOS,
          ...data.settings?.triggerScenarios,
        },
      })
      setSuccess('Outbound agent settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const masterOff = !settings.masterEnabled
  const triggerScenarios = settings.triggerScenarios ?? DEFAULT_TRIGGER_SCENARIOS

  const setTriggerScenario = (key: OpenSlotTriggerScenario, enabled: boolean) => {
    setSettings((s) => ({
      ...s,
      triggerScenarios: {
        ...(s.triggerScenarios ?? DEFAULT_TRIGGER_SCENARIOS),
        [key]: enabled,
      },
    }))
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle>Outbound AI Agents</CardTitle>
        <CardDescription>
          Enable automated outbound agents for this practice. Appointment Optimization contacts
          patients with later visits when an earlier slot opens — regardless of whether the change
          comes from the CRM, patient portal, Cal.com, eClinicalWorks, Open Dental, or another
          connected system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <Label className="text-base font-medium">Enable outbound agents</Label>
            <p className="text-sm text-gray-500 mt-1">Master switch for all outbound AI agents</p>
          </div>
          <Switch
            checked={settings.masterEnabled}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, masterEnabled: checked }))
            }
            disabled={loading}
          />
        </div>

        <div className="space-y-4 pl-2 border-l-2 border-gray-100 ml-1">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 opacity-100">
            <div>
              <Label className="font-medium">Insurance Verification Agent</Label>
              <p className="text-sm text-gray-500 mt-1">
                Uses your Retell insurance verification agent for outbound calls
              </p>
            </div>
            <Switch
              checked={settings.insuranceVerificationEnabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, insuranceVerificationEnabled: checked }))
              }
              disabled={loading || masterOff}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <Label className="font-medium">Outbound Appointment Optimization Agent</Label>
              <p className="text-sm text-gray-500 mt-1">
                Notifies eligible patients when earlier slots open (SMS or voice, portal link)
              </p>
            </div>
            <Switch
              checked={settings.appointmentOptimizationEnabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, appointmentOptimizationEnabled: checked }))
              }
              disabled={loading || masterOff}
            />
          </div>
        </div>

        {settings.appointmentOptimizationEnabled && !masterOff && (
          <div className="space-y-6 border-t pt-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-4">
              <div>
                <Label className="text-base font-medium">Trigger scenarios</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Choose which events create an open slot and start outreach. These apply to
                  appointment changes from any source — CRM, portal, Cal.com, eClinicalWorks, Open
                  Dental, and other connected EHR/EMR systems.
                </p>
              </div>
              <div className="space-y-3">
                {OPEN_SLOT_TRIGGER_SCENARIO_OPTIONS.map((scenario) => (
                  <div
                    key={scenario.key}
                    className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="min-w-0">
                      <Label className="font-medium">{scenario.label}</Label>
                      <p className="text-sm text-gray-500 mt-1">{scenario.description}</p>
                    </div>
                    <Switch
                      checked={triggerScenarios[scenario.key]}
                      onCheckedChange={(checked) => setTriggerScenario(scenario.key, checked)}
                      disabled={loading}
                      className="shrink-0 mt-1"
                    />
                  </div>
                ))}
              </div>
              {!triggerScenarios.cancellation &&
                !triggerScenarios.noShow &&
                !triggerScenarios.reschedule &&
                !triggerScenarios.availability && (
                  <p className="text-sm text-amber-700">
                    No trigger scenarios are enabled. The agent will not start outreach until at
                    least one scenario is turned on.
                  </p>
                )}
            </div>

            <div>
              <Label>Outreach channel</Label>
              <Select
                value={settings.outreachChannel || 'sms'}
                onValueChange={(value) =>
                  setSettings((s) => ({ ...s, outreachChannel: value }))
                }
              >
                <SelectTrigger className="mt-2 w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="voice">Voice call</SelectItem>
                  <SelectItem value="prefer_sms">Prefer SMS</SelectItem>
                  <SelectItem value="prefer_voice">Prefer voice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SMS template name (Marketing)</Label>
              <Input
                className="mt-2 max-w-md"
                value={settings.smsTemplateName || 'Earlier Appointment Available'}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, smsTemplateName: e.target.value }))
                }
                placeholder="Earlier Appointment Available"
              />
              <p className="text-xs text-gray-500 mt-1">
                Published SMS template in Marketing. Variables: patient.firstName,
                appointment.date, appointment.time, appointment.providerName,
                links.portalAppointments
              </p>
            </div>
          </div>
        )}

        <Button onClick={save} disabled={saving || loading}>
          {saving ? 'Saving...' : 'Save outbound settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
