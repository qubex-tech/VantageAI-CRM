'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { OutboundAgentsSettings, SlotFillRule } from '@/lib/appointment-optimization/types'
import {
  DEFAULT_OUTBOUND_AGENTS,
  DEFAULT_SLOT_FILL_RULE,
  DEFAULT_TRIGGER_SCENARIOS,
  MAX_SLOT_FILL_RULES,
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

interface SmsMarketingTemplate {
  id: string
  name: string
}

function buildSmsTemplatesUrl(practiceId?: string) {
  const params = new URLSearchParams({ channel: 'sms', status: 'published' })
  if (practiceId) params.set('practiceId', practiceId)
  return `/api/marketing/templates?${params}`
}

function outreachUsesSms(channel?: string) {
  return channel === 'sms' || channel === 'prefer_sms' || !channel
}

function outreachUsesCurogramSms(channel?: string) {
  return channel === 'curogram_sms'
}

function normalizeLoadedSlotFillRules(
  rules: Array<SlotFillRule & { lookAheadBusinessDays?: number }> | undefined
): SlotFillRule[] {
  return (rules ?? []).map((rule) => ({
    ...DEFAULT_SLOT_FILL_RULE,
    ...rule,
    lookAheadStartBusinessDays:
      rule.lookAheadStartBusinessDays ??
      (rule.lookAheadBusinessDays != null
        ? 1
        : DEFAULT_SLOT_FILL_RULE.lookAheadStartBusinessDays),
    lookAheadEndBusinessDays:
      rule.lookAheadEndBusinessDays ??
      rule.lookAheadBusinessDays ??
      DEFAULT_SLOT_FILL_RULE.lookAheadEndBusinessDays,
  }))
}

export function OutboundAgentsSettings({ practiceId }: OutboundAgentsSettingsProps) {
  const [settings, setSettings] = useState<OutboundAgentsSettings>(DEFAULT_OUTBOUND_AGENTS)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [visitTypes, setVisitTypes] = useState<string[]>([])
  const [smsTemplates, setSmsTemplates] = useState<SmsMarketingTemplate[]>([])
  const [loadingSmsTemplates, setLoadingSmsTemplates] = useState(false)

  const visitTypesUrl = useMemo(() => {
    const base = '/api/appointments/visit-types'
    if (!practiceId) return base
    return `${base}?practiceId=${encodeURIComponent(practiceId)}`
  }, [practiceId])

  const apiUrl = useMemo(() => buildApiUrl(practiceId), [practiceId])
  const smsTemplatesUrl = useMemo(() => buildSmsTemplatesUrl(practiceId), [practiceId])

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
        waveIntervalMinutes:
          data.settings?.waveIntervalMinutes ?? DEFAULT_OUTBOUND_AGENTS.waveIntervalMinutes,
        slotFillRules: normalizeLoadedSlotFillRules(data.settings?.slotFillRules),
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

  useEffect(() => {
    const loadVisitTypes = async () => {
      try {
        const res = await fetch(visitTypesUrl)
        const data = await res.json()
        if (res.ok && Array.isArray(data.visitTypes)) {
          setVisitTypes(data.visitTypes)
        }
      } catch {
        // Non-blocking; admin can still type if needed
      }
    }
    loadVisitTypes()
  }, [visitTypesUrl])

  useEffect(() => {
    if (!practiceId) {
      setSmsTemplates([])
      return
    }

    const loadSmsTemplates = async () => {
      setLoadingSmsTemplates(true)
      try {
        const res = await fetch(smsTemplatesUrl)
        const data = await res.json()
        if (res.ok && Array.isArray(data.templates)) {
          setSmsTemplates(
            data.templates.map((template: SmsMarketingTemplate) => ({
              id: template.id,
              name: template.name,
            }))
          )
        } else {
          setSmsTemplates([])
        }
      } catch {
        setSmsTemplates([])
      } finally {
        setLoadingSmsTemplates(false)
      }
    }
    loadSmsTemplates()
  }, [practiceId, smsTemplatesUrl])

  const publishedTemplateNames = useMemo(
    () => new Set(smsTemplates.map((template) => template.name)),
    [smsTemplates]
  )
  const selectedSmsTemplateName = settings.smsTemplateName?.trim() || ''
  const selectedCurogramTemplateName = settings.curogramSmsTemplateName?.trim() || ''
  const selectedCurogramActionId = settings.curogramSmsActionId?.trim() || ''
  const smsTemplateMissing =
    Boolean(selectedSmsTemplateName) && !publishedTemplateNames.has(selectedSmsTemplateName)
  const needsSmsTemplate = outreachUsesSms(settings.outreachChannel)
  const needsCurogramTemplate = outreachUsesCurogramSms(settings.outreachChannel)

  const save = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (
        settings.appointmentOptimizationEnabled &&
        settings.masterEnabled &&
        needsSmsTemplate &&
        !selectedSmsTemplateName
      ) {
        throw new Error('Select a published SMS marketing template')
      }
      if (needsSmsTemplate && smsTemplateMissing) {
        throw new Error('Selected SMS template is not published. Create or publish it in Marketing.')
      }
      if (
        settings.appointmentOptimizationEnabled &&
        settings.masterEnabled &&
        needsCurogramTemplate &&
        !selectedCurogramTemplateName
      ) {
        throw new Error('Provide a Curogram SMS template name')
      }
      if (
        settings.appointmentOptimizationEnabled &&
        settings.masterEnabled &&
        needsCurogramTemplate &&
        !selectedCurogramActionId
      ) {
        throw new Error('Provide a Curogram action ID')
      }

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
        waveIntervalMinutes:
          data.settings?.waveIntervalMinutes ?? DEFAULT_OUTBOUND_AGENTS.waveIntervalMinutes,
        slotFillRules: normalizeLoadedSlotFillRules(data.settings?.slotFillRules),
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

  const slotFillRules = settings.slotFillRules ?? []

  const setTriggerScenario = (key: OpenSlotTriggerScenario, enabled: boolean) => {
    setSettings((s) => ({
      ...s,
      triggerScenarios: {
        ...(s.triggerScenarios ?? DEFAULT_TRIGGER_SCENARIOS),
        [key]: enabled,
      },
    }))
  }

  const updateSlotFillRule = (id: string, patch: Partial<SlotFillRule>) => {
    setSettings((s) => ({
      ...s,
      slotFillRules: (s.slotFillRules ?? []).map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule
      ),
    }))
  }

  const addSlotFillRule = () => {
    setSettings((s) => {
      const rules = s.slotFillRules ?? []
      if (rules.length >= MAX_SLOT_FILL_RULES) return s
      return {
        ...s,
        slotFillRules: [
          ...rules,
          {
            id: crypto.randomUUID(),
            visitType: visitTypes[0] ?? '',
            ...DEFAULT_SLOT_FILL_RULE,
          },
        ],
      }
    })
  }

  const removeSlotFillRule = (id: string) => {
    setSettings((s) => ({
      ...s,
      slotFillRules: (s.slotFillRules ?? []).filter((rule) => rule.id !== id),
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

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-4">
              <div>
                <Label className="text-base font-medium">Slot fill rules</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Rules apply to any open slot ingested into Slot Fill — from a cancellation,
                  EHR schedule, Cal.com, Open Dental, or manual ingest — regardless of source.
                  Buffer (business days) limits how soon empty slots are acted on.
                  Look-ahead from/to are calendar days after the open slot (e.g. 7–14
                  means engage patients booked 7 to 14 days later).
                </p>
              </div>

              {slotFillRules.length === 0 && (
                <p className="text-sm text-gray-600">
                  No rules configured. Cancellations and other triggers use legacy outreach (no
                  buffer / look-ahead). Add a rule to enable visit-type-specific windows.
                </p>
              )}

              <div className="space-y-3">
                {slotFillRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-[1.2fr_110px_110px_110px_auto_auto] md:items-end"
                  >
                    <div>
                      <Label className="text-xs text-gray-500">Visit type</Label>
                      <Select
                        value={rule.visitType || undefined}
                        onValueChange={(value) => updateSlotFillRule(rule.id, { visitType: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select visit type" />
                        </SelectTrigger>
                        <SelectContent>
                          {visitTypes.map((vt) => (
                            <SelectItem key={vt} value={vt}>
                              {vt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Buffer (biz days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        className="mt-1"
                        value={rule.bufferBusinessDays}
                        onChange={(e) =>
                          updateSlotFillRule(rule.id, {
                            bufferBusinessDays: Number(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Look ahead from (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        className="mt-1"
                        value={rule.lookAheadStartBusinessDays}
                        onChange={(e) => {
                          const start = Number(e.target.value) || 1
                          updateSlotFillRule(rule.id, {
                            lookAheadStartBusinessDays: start,
                            lookAheadEndBusinessDays: Math.max(
                              start,
                              rule.lookAheadEndBusinessDays
                            ),
                          })
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Look ahead to (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        className="mt-1"
                        value={rule.lookAheadEndBusinessDays}
                        onChange={(e) => {
                          const end = Number(e.target.value) || 1
                          updateSlotFillRule(rule.id, {
                            lookAheadEndBusinessDays: end,
                            lookAheadStartBusinessDays: Math.min(
                              rule.lookAheadStartBusinessDays,
                              end
                            ),
                          })
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Switch
                        checked={rule.enabled !== false}
                        onCheckedChange={(checked) =>
                          updateSlotFillRule(rule.id, { enabled: checked })
                        }
                        aria-label="Enable rule"
                      />
                      <span className="text-xs text-gray-500">On</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 hover:text-red-600"
                      onClick={() => removeSlotFillRule(rule.id)}
                      aria-label="Remove rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSlotFillRule}
                disabled={loading || slotFillRules.length >= MAX_SLOT_FILL_RULES}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add rule
              </Button>

              <div className="pt-2 border-t border-gray-200">
                <Label className="text-sm font-medium">Wave frequency (minutes)</Label>
                <p className="text-xs text-gray-500 mt-1 mb-2">
                  Minutes to wait between outreach waves while the slot is still open.
                </p>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  className="max-w-[160px]"
                  value={settings.waveIntervalMinutes ?? 10}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      waveIntervalMinutes: Math.min(
                        1440,
                        Math.max(1, Number(e.target.value) || 10)
                      ),
                    }))
                  }
                />
              </div>
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
                  <SelectItem value="curogram_sms">Curogram SMS</SelectItem>
                  <SelectItem value="voice">Voice call</SelectItem>
                  <SelectItem value="prefer_sms">Prefer SMS</SelectItem>
                  <SelectItem value="prefer_voice">Prefer voice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsSmsTemplate && (
              <div>
                <Label>SMS reply handling</Label>
                <Select
                  value={settings.smsReplyHandling || 'telnyx_inbound'}
                  onValueChange={(value) =>
                    setSettings((s) => ({
                      ...s,
                      smsReplyHandling: value as 'telnyx_inbound' | 'practice_number',
                    }))
                  }
                >
                  <SelectTrigger className="mt-2 w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telnyx_inbound">
                      Vantage Telnyx number (auto-book on YES reply)
                    </SelectItem>
                    <SelectItem value="practice_number">
                      Practice-owned number (no inbound replies)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  If SMS is sent from the practice&apos;s own number, replies won&apos;t reach Vantage —
                  use the portal link in your template instead of reply-to-book.
                </p>
              </div>
            )}
            {needsSmsTemplate && (
              <div>
                <Label>SMS template (Marketing)</Label>
                <Select
                  value={selectedSmsTemplateName || undefined}
                  onValueChange={(value) =>
                    setSettings((s) => ({ ...s, smsTemplateName: value }))
                  }
                  disabled={loading || loadingSmsTemplates || smsTemplates.length === 0}
                >
                  <SelectTrigger className="mt-2 w-full max-w-md">
                    <SelectValue
                      placeholder={
                        loadingSmsTemplates
                          ? 'Loading templates...'
                          : 'Select a published SMS template'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {smsTemplateMissing && selectedSmsTemplateName && (
                      <SelectItem value={selectedSmsTemplateName} disabled>
                        {selectedSmsTemplateName} (not published)
                      </SelectItem>
                    )}
                    {smsTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {smsTemplates.length === 0 && !loadingSmsTemplates && (
                  <p className="text-xs text-amber-700 mt-1">
                    No published SMS templates for this practice.{' '}
                    <a href="/marketing/templates?channel=sms&status=published" className="underline">
                      Create one in Marketing
                    </a>{' '}
                    and publish it before saving.
                  </p>
                )}
                {smsTemplateMissing && (
                  <p className="text-xs text-amber-700 mt-1">
                    &quot;{selectedSmsTemplateName}&quot; is not a published SMS template. Choose
                    one from the list or publish it in Marketing.
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Current visit: currentAppointment.date, currentAppointment.time,
                  currentAppointment.dateTime. Offered slot: offeredSlot.date,
                  offeredSlot.time, offeredSlot.dateTime. Also: patient.firstName,
                  links.portalAppointments
                </p>
              </div>
            )}
            {needsCurogramTemplate && (
              <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                <div>
                  <Label>Curogram SMS template name</Label>
                  <Input
                    className="mt-2 w-full max-w-md"
                    value={settings.curogramSmsTemplateName || ''}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        curogramSmsTemplateName: e.target.value,
                      }))
                    }
                    placeholder="New Patient Intake Template"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Internal name to identify this Curogram template/workflow in CRM.
                  </p>
                </div>
                <div>
                  <Label>Curogram action ID</Label>
                  <Input
                    className="mt-2 w-full max-w-md"
                    value={settings.curogramSmsActionId || ''}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        curogramSmsActionId: e.target.value,
                      }))
                    }
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Action ID configured in Curogram for this SMS template/workflow.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <Button onClick={save} disabled={saving || loading}>
          {saving ? 'Saving...' : 'Save outbound settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
