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
import {
  CLINICAL_SYSTEM_OPTIONS,
  type ClinicalSystemType,
} from '@/lib/integrations/clinical-system/types'
import { EhrIntegrationsSettings } from './EhrIntegrationsSettings'
import { OpenDentalSettings } from './OpenDentalSettings'
import { SchedulingModeSettings } from './SchedulingModeSettings'

interface ClinicalIntegrationsSettingsProps {
  practiceId?: string
}

export function ClinicalIntegrationsSettings({ practiceId }: ClinicalIntegrationsSettingsProps) {
  const [practices, setPractices] = useState<Array<{ id: string; name: string }>>([])
  const [selectedPracticeId, setSelectedPracticeId] = useState('')
  const [clinicalSystem, setClinicalSystem] = useState<ClinicalSystemType>('none')
  const [inferred, setInferred] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const activePracticeId = practiceId || selectedPracticeId

  const apiUrl = (path: string) => {
    if (!activePracticeId) return path
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}practiceId=${encodeURIComponent(activePracticeId)}`
  }

  const loadClinicalSystem = async (targetPracticeId: string) => {
    const response = await fetch(apiUrl('/api/settings/clinical-system'))
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Failed to load clinical system settings')
    }
    const data = await response.json()
    setClinicalSystem(data.settings?.system ?? 'none')
    setInferred(Boolean(data.inferred))
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        if (!practiceId) {
          const response = await fetch('/api/practices')
          if (response.ok) {
            const data = await response.json()
            setPractices(data.practices || [])
            if (data.practices?.[0]?.id) {
              setSelectedPracticeId(data.practices[0].id)
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load practices')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [practiceId])

  useEffect(() => {
    if (!activePracticeId) {
      setClinicalSystem('none')
      setInferred(false)
      return
    }

    const load = async () => {
      setLoading(true)
      setError('')
      setSuccess('')
      try {
        await loadClinicalSystem(activePracticeId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clinical system')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [activePracticeId])

  const handleSaveSystem = async () => {
    if (!activePracticeId) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/settings/clinical-system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: activePracticeId,
          system: clinicalSystem,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save clinical system')
      }

      const data = await response.json()
      setClinicalSystem(data.settings?.system ?? clinicalSystem)
      setInferred(false)
      setSuccess('Clinical system saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save clinical system')
    } finally {
      setSaving(false)
    }
  }

  const selectedOption = CLINICAL_SYSTEM_OPTIONS.find((option) => option.id === clinicalSystem)

  if (loading && !activePracticeId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Clinical system</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Choose which EHR or practice management system this practice connects to. Provider-specific
            settings appear below after you save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!practiceId && (
            <div className="space-y-2">
              <label htmlFor="clinical-practice-select" className="text-sm font-medium text-gray-700">
                Practice
              </label>
              <Select value={selectedPracticeId} onValueChange={setSelectedPracticeId}>
                <SelectTrigger id="clinical-practice-select">
                  <SelectValue placeholder="Select a practice" />
                </SelectTrigger>
                <SelectContent>
                  {practices.map((practice) => (
                    <SelectItem key={practice.id} value={practice.id}>
                      {practice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {activePracticeId && (
            <>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading clinical system...
                </div>
              ) : (
                <>
                  {inferred && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      No explicit clinical system is saved yet. We inferred{' '}
                      <span className="font-medium">{selectedOption?.label ?? clinicalSystem}</span>{' '}
                      from existing integration data. Save to lock in your choice.
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="clinical-system-select" className="text-sm font-medium text-gray-700">
                      Clinical system integration
                    </label>
                    <Select
                      value={clinicalSystem}
                      onValueChange={(value) => setClinicalSystem(value as ClinicalSystemType)}
                    >
                      <SelectTrigger id="clinical-system-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLINICAL_SYSTEM_OPTIONS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedOption && (
                      <p className="text-xs text-gray-500">{selectedOption.description}</p>
                    )}
                  </div>

                  {error && <div className="text-sm text-red-600">{error}</div>}
                  {success && <div className="text-sm text-green-700">{success}</div>}

                  <Button type="button" onClick={handleSaveSystem} disabled={saving}>
                    {saving ? 'Saving...' : 'Save clinical system'}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {activePracticeId && !loading && (
        <SchedulingModeSettings
          key={activePracticeId}
          practiceId={activePracticeId}
          openDentalAvailable={clinicalSystem === 'open_dental'}
          ecwAvailable={clinicalSystem === 'fhir'}
        />
      )}

      {activePracticeId && !loading && clinicalSystem === 'fhir' && (
        <EhrIntegrationsSettings practiceId={activePracticeId} embedded />
      )}

      {activePracticeId && !loading && clinicalSystem === 'open_dental' && (
        <OpenDentalSettings practiceId={activePracticeId} />
      )}

      {activePracticeId && !loading && clinicalSystem === 'none' && (
        <Card className="border border-dashed border-gray-200">
          <CardContent className="py-8 text-center text-sm text-gray-500">
            No clinical system selected. Choose FHIR or Open Dental above to configure integration
            settings.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
