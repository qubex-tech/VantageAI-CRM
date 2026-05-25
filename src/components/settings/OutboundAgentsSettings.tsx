'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { OutboundAgentsSettings } from '@/lib/appointment-optimization/types'
import { DEFAULT_OUTBOUND_AGENTS } from '@/lib/appointment-optimization/types'

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
      setSettings({ ...DEFAULT_OUTBOUND_AGENTS, ...data.settings })
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
      setSettings({ ...DEFAULT_OUTBOUND_AGENTS, ...data.settings })
      setSuccess('Outbound agent settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const masterOff = !settings.masterEnabled

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle>Outbound AI Agents</CardTitle>
        <CardDescription>
          Enable automated outbound agents for this practice. Appointment Optimization contacts
          patients with later visits when an earlier slot opens (portal self-reschedule only).
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
          <div className="space-y-4 border-t pt-4">
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
