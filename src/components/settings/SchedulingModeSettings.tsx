'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
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
import { Loader2, CalendarClock, X, Plus, ChevronDown, Check } from 'lucide-react'
import type {
  OdBookSlotConfig,
  OdReadSlotConfig,
  SchedulingSource,
  VisitTypeMapping,
} from '@/lib/integrations/clinical-system/types'
import { mirrorOdConfigsToLegacyDefaults } from '@/lib/integrations/clinical-system/types'

interface SchedulingModeSettingsProps {
  practiceId: string
  /** Whether Open Dental is the selected clinical system (enables EHR-native scheduling). */
  openDentalAvailable: boolean
  /** Whether FHIR / eClinicalWorks is configured for this practice. */
  ecwAvailable: boolean
}

interface EcwPractitionerOption {
  id: string
  reference: string
  name: string
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
const ADD_OPERATORY = 'add-operatory'
const ADD_PRACTITIONER = 'add-practitioner'

function practitionerLabel(practitioners: EcwPractitionerOption[], reference: string): string {
  return practitioners.find((p) => p.reference === reference)?.name ?? reference
}

function operatoryLabel(operatories: OperatoryOption[], operatoryNum: number): string {
  return operatories.find((o) => o.operatoryNum === operatoryNum)?.name ?? `OP-${operatoryNum}`
}

function providerLabel(providers: ProviderOption[], provNum: number): string {
  return providers.find((p) => p.provNum === provNum)?.name ?? `Provider ${provNum}`
}

function EcwPractitionerFilterEditor({
  practitioners,
  selectedRefs,
  onChangeSelected,
}: {
  practitioners: EcwPractitionerOption[]
  selectedRefs: string[]
  onChangeSelected: (refs: string[]) => void
}) {
  const reserved = new Set(selectedRefs)
  const available = practitioners.filter((p) => !reserved.has(p.reference))

  const handleAdd = (value: string) => {
    if (value === ADD_PRACTITIONER) return
    if (!value || reserved.has(value)) return
    onChangeSelected([...selectedRefs, value])
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <div>
        <p className="text-sm font-medium text-gray-700">Practitioners to include</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Leave empty to pull appointments and open slots for every eCW practitioner. Add
          practitioners here to limit availability to specific providers.
        </p>
      </div>
      {selectedRefs.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selectedRefs.map((reference) => (
            <li
              key={reference}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-800"
            >
              {practitionerLabel(practitioners, reference)}
              <button
                type="button"
                onClick={() => onChangeSelected(selectedRefs.filter((ref) => ref !== reference))}
                className="rounded p-0.5 text-gray-400 hover:text-gray-700"
                aria-label={`Remove ${practitionerLabel(practitioners, reference)}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-600 rounded-md border border-dashed border-gray-200 bg-white px-3 py-2">
          All practitioners ({practitioners.length}) — full eCW schedule will be synced and read.
        </p>
      )}
      {available.length > 0 && (
        <Select value={ADD_PRACTITIONER} onValueChange={handleAdd}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Limit to practitioner…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ADD_PRACTITIONER} disabled>
              Limit to practitioner…
            </SelectItem>
            {available.map((p) => (
              <SelectItem key={p.reference} value={p.reference}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

function MultiOperatoryPicker({
  selected,
  operatories,
  onChange,
}: {
  selected: number[]
  operatories: OperatoryOption[]
  onChange: (nums: number[]) => void
}) {
  const reserved = new Set(selected)
  const available = operatories.filter((o) => !reserved.has(o.operatoryNum))

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((num) => (
            <li
              key={num}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-800"
            >
              {operatoryLabel(operatories, num)}
              <button
                type="button"
                onClick={() => onChange(selected.filter((n) => n !== num))}
                className="rounded p-0.5 text-gray-400 hover:text-gray-700"
                aria-label={`Remove ${operatoryLabel(operatories, num)}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">No operatories selected.</p>
      )}
      {available.length > 0 && (
        <Select
          value={ADD_OPERATORY}
          onValueChange={(value) => {
            if (value === ADD_OPERATORY) return
            const num = Number(value)
            if (!Number.isInteger(num) || num <= 0 || reserved.has(num)) return
            onChange([...selected, num])
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Add operatory…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ADD_OPERATORY} disabled>
              Add operatory…
            </SelectItem>
            {available.map((o) => (
              <SelectItem key={o.operatoryNum} value={String(o.operatoryNum)}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

function SearchableVisitTypePicker({
  selected,
  allVisitTypes,
  reservedByOthers,
  onChange,
}: {
  selected: VisitTypeMapping[]
  allVisitTypes: string[]
  reservedByOthers: Set<string>
  onChange: (next: VisitTypeMapping[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({})
  const [expandedAliases, setExpandedAliases] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selectedByKey = useMemo(() => {
    const map = new Map<string, VisitTypeMapping>()
    for (const mapping of selected) {
      map.set(mapping.visitType.trim().toLowerCase(), mapping)
    }
    return map
  }, [selected])

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allVisitTypes.filter((vt) => {
      const key = vt.trim().toLowerCase()
      // Keep already-selected options visible (checked); hide ones claimed by other rows.
      if (reservedByOthers.has(key) && !selectedByKey.has(key)) return false
      if (!q) return true
      return vt.toLowerCase().includes(q)
    })
  }, [allVisitTypes, query, reservedByOthers, selectedByKey])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const toggleVisitType = (visitType: string) => {
    const key = visitType.trim().toLowerCase()
    if (!key || reservedByOthers.has(key)) return
    if (selectedByKey.has(key)) {
      onChange(selected.filter((s) => s.visitType.trim().toLowerCase() !== key))
      if (expandedAliases?.trim().toLowerCase() === key) setExpandedAliases(null)
      return
    }
    onChange([...selected, { visitType: visitType.trim(), aliases: [] }])
  }

  const addAlias = (visitType: string) => {
    const draft = (aliasDrafts[visitType] || '').trim()
    if (!draft) return
    onChange(
      selected.map((s) =>
        s.visitType === visitType &&
        !s.aliases.some((a) => a.trim().toLowerCase() === draft.toLowerCase())
          ? { ...s, aliases: [...s.aliases, draft] }
          : s
      )
    )
    setAliasDrafts((prev) => ({ ...prev, [visitType]: '' }))
  }

  const removeAlias = (visitType: string, alias: string) => {
    onChange(
      selected.map((s) =>
        s.visitType === visitType
          ? { ...s, aliases: s.aliases.filter((a) => a !== alias) }
          : s
      )
    )
  }

  const triggerLabel =
    selected.length === 0
      ? 'Select visit types…'
      : selected.length === 1
        ? selected[0].visitType
        : `${selected.length} visit types selected`

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={allVisitTypes.length === 0}
          className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={selected.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
            {allVisitTypes.length === 0 ? 'No EMR visit types available' : triggerLabel}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 p-2">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search EMR visit types…"
                className="h-8 text-sm"
              />
            </div>
            <ul className="max-h-56 overflow-auto py-1" role="listbox" aria-multiselectable="true">
              {options.length === 0 ? (
                <li className="px-3 py-2 text-xs text-gray-500">No matching visit types.</li>
              ) : (
                options.map((vt) => {
                  const key = vt.trim().toLowerCase()
                  const checked = selectedByKey.has(key)
                  return (
                    <li key={vt} role="option" aria-selected={checked}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                        onClick={() => toggleVisitType(vt)}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                          aria-hidden="true"
                        >
                          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="truncate">{vt}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            {selected.length > 0 && (
              <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                {selected.length} selected — click outside to close
              </div>
            )}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((mapping) => (
            <li key={mapping.visitType}>
              <button
                type="button"
                onClick={() =>
                  setExpandedAliases((current) =>
                    current === mapping.visitType ? null : mapping.visitType
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-800 hover:border-gray-300"
                title="Click to manage aliases"
              >
                {mapping.visitType}
                {mapping.aliases.length > 0 && (
                  <span className="text-xs text-gray-500">+{mapping.aliases.length}</span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleVisitType(mapping.visitType)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleVisitType(mapping.visitType)
                    }
                  }}
                  className="rounded p-0.5 text-gray-400 hover:text-gray-700"
                  aria-label={`Remove ${mapping.visitType}`}
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {expandedAliases && selected.some((s) => s.visitType === expandedAliases) && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-700">Aliases for {expandedAliases}</p>
          {selected
            .find((s) => s.visitType === expandedAliases)
            ?.aliases.map((alias) => (
              <span
                key={alias}
                className="mr-1.5 mb-1 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700"
              >
                {alias}
                <button
                  type="button"
                  onClick={() => removeAlias(expandedAliases, alias)}
                  className="text-gray-400 hover:text-gray-700"
                  aria-label={`Remove alias ${alias}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          <div className="flex gap-2">
            <Input
              value={aliasDrafts[expandedAliases] || ''}
              onChange={(e) =>
                setAliasDrafts((prev) => ({ ...prev, [expandedAliases]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAlias(expandedAliases)
                }
              }}
              placeholder="Add natural-language alias…"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addAlias(expandedAliases)}
            >
              Alias
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function emptyReadDraft(): { provNum: string; operatoryNums: number[]; lengthMinutes: string } {
  return { provNum: NONE, operatoryNums: [], lengthMinutes: '30' }
}

function emptyBookDraft(): {
  provNum: string
  operatoryNums: number[]
  lengthMinutes: string
  visitTypes: VisitTypeMapping[]
} {
  return { provNum: NONE, operatoryNums: [], lengthMinutes: '30', visitTypes: [] }
}

export function SchedulingModeSettings({
  practiceId,
  openDentalAvailable,
  ecwAvailable,
}: SchedulingModeSettingsProps) {
  const [readSource, setReadSource] = useState<SchedulingSource>('cal')
  const [writeSource, setWriteSource] = useState<SchedulingSource>('cal')
  const [readConfigs, setReadConfigs] = useState<OdReadSlotConfig[]>([])
  const [bookConfigs, setBookConfigs] = useState<OdBookSlotConfig[]>([])
  const [readDraft, setReadDraft] = useState(emptyReadDraft)
  const [bookDraft, setBookDraft] = useState(emptyBookDraft)
  const [defaultReadPractitionerRefs, setDefaultReadPractitionerRefs] = useState<string[]>([])
  const [defaultWritePractitionerRef, setDefaultWritePractitionerRef] = useState<string>(NONE)
  const [defaultReadLengthMinutes, setDefaultReadLengthMinutes] = useState<string>(NONE)
  const [defaultLengthMinutes, setDefaultLengthMinutes] = useState<number>(30)
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [operatories, setOperatories] = useState<OperatoryOption[]>([])
  const [visitTypes, setVisitTypes] = useState<string[]>([])
  const [ecwPractitioners, setEcwPractitioners] = useState<EcwPractitionerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLists, setLoadingLists] = useState(false)
  const [loadingEcwPractitioners, setLoadingEcwPractitioners] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const needsOpenDentalLists = readSource === 'open_dental' || writeSource === 'open_dental'
  const needsEcwPractitioners = readSource === 'ecw' || writeSource === 'ecw'

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
          setReadSource(sched.readSource ?? (sched.mode === 'open_dental' ? 'open_dental' : 'cal'))
          setWriteSource(sched.writeSource ?? (sched.mode === 'open_dental' ? 'open_dental' : 'cal'))
          setDefaultReadLengthMinutes(
            sched.defaultReadLengthMinutes ? String(sched.defaultReadLengthMinutes) : NONE
          )
          setDefaultLengthMinutes(sched.defaultLengthMinutes ?? 30)
          setDefaultReadPractitionerRefs(
            Array.isArray(sched.defaultReadPractitionerRefs)
              ? sched.defaultReadPractitionerRefs
              : sched.defaultReadPractitionerRef
                ? [sched.defaultReadPractitionerRef]
                : []
          )
          setDefaultWritePractitionerRef(sched.defaultWritePractitionerRef || NONE)

          if (Array.isArray(sched.odReadSlotConfigs) && sched.odReadSlotConfigs.length > 0) {
            setReadConfigs(sched.odReadSlotConfigs)
          } else {
            const prov = sched.defaultReadProvNum || sched.defaultProvNum
            const ops = [
              ...(sched.defaultReadOperatoryNum ? [sched.defaultReadOperatoryNum] : []),
              ...(Array.isArray(sched.defaultReadOperatoryNums) ? sched.defaultReadOperatoryNums : []),
            ]
            const uniqueOps = [...new Set(ops.filter((n: number) => Number.isInteger(n) && n > 0))]
            if (prov && uniqueOps.length > 0) {
              setReadConfigs([
                {
                  provNum: prov,
                  operatoryNums: uniqueOps,
                  lengthMinutes: sched.defaultReadLengthMinutes || sched.defaultLengthMinutes || 30,
                },
              ])
            } else {
              setReadConfigs([])
            }
          }

          if (Array.isArray(sched.odBookSlotConfigs) && sched.odBookSlotConfigs.length > 0) {
            setBookConfigs(
              sched.odBookSlotConfigs.map((row: OdBookSlotConfig) => ({
                ...row,
                visitTypes: (row.visitTypes || []).map((vt) =>
                  typeof vt === 'string'
                    ? { visitType: vt, aliases: [] }
                    : {
                        visitType: vt.visitType,
                        aliases: Array.isArray(vt.aliases) ? vt.aliases : [],
                      }
                ),
              }))
            )
          } else {
            const prov = sched.defaultProvNum
            const ops = [
              ...(sched.defaultOperatoryNum ? [sched.defaultOperatoryNum] : []),
              ...(Array.isArray(sched.defaultOperatoryNums) ? sched.defaultOperatoryNums : []),
            ]
            const uniqueOps = [...new Set(ops.filter((n: number) => Number.isInteger(n) && n > 0))]
            if (prov && uniqueOps.length > 0) {
              setBookConfigs([
                {
                  provNum: prov,
                  operatoryNums: uniqueOps,
                  lengthMinutes: sched.defaultLengthMinutes || 30,
                  visitTypes: [],
                },
              ])
            } else {
              setBookConfigs([])
            }
          }
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

  const loadEcwPractitioners = useCallback(async () => {
    setLoadingEcwPractitioners(true)
    try {
      const res = await fetch(withPractice('/api/integrations/ehr/practitioners'))
      const data = await res.json()
      if (res.ok) setEcwPractitioners(data.practitioners || [])
    } catch {
      // Non-fatal
    } finally {
      setLoadingEcwPractitioners(false)
    }
  }, [practiceId])

  const loadLists = useCallback(async () => {
    setLoadingLists(true)
    try {
      const [pRes, oRes, odTypesRes, vRes] = await Promise.all([
        fetch(withPractice('/api/integrations/opendental/providers')),
        fetch(withPractice('/api/integrations/opendental/operatories')),
        fetch(withPractice('/api/integrations/opendental/appointment-types')),
        fetch(withPractice('/api/appointments/visit-types')),
      ])
      const pData = await pRes.json()
      const oData = await oRes.json()
      const odTypesData = await odTypesRes.json().catch(() => ({}))
      const vData = await vRes.json().catch(() => ({}))
      if (pRes.ok)
        setProviders(
          (pData.providers || []).filter((p: ProviderOption & { isHidden?: boolean }) => !p.isHidden)
        )
      if (oRes.ok)
        setOperatories(
          (oData.operatories || []).filter(
            (o: OperatoryOption & { isHidden?: boolean }) => !o.isHidden
          )
        )

      // Prefer Open Dental AppointmentTypes (EMR), then merge CRM/Cal names.
      const names = new Set<string>()
      if (odTypesRes.ok && Array.isArray(odTypesData.appointmentTypes)) {
        for (const row of odTypesData.appointmentTypes as Array<{ name?: string }>) {
          if (row?.name?.trim()) names.add(row.name.trim())
        }
      }
      if (vRes.ok && Array.isArray(vData.visitTypes)) {
        for (const name of vData.visitTypes as string[]) {
          if (name?.trim()) names.add(name.trim())
        }
      }
      setVisitTypes(Array.from(names).sort((a, b) => a.localeCompare(b)))
    } catch {
      // Non-fatal — admin can still pick sources without defaults.
    } finally {
      setLoadingLists(false)
    }
  }, [practiceId])

  useEffect(() => {
    if (needsOpenDentalLists && openDentalAvailable && providers.length === 0 && operatories.length === 0) {
      loadLists()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOpenDentalLists, openDentalAvailable])

  useEffect(() => {
    if (needsEcwPractitioners && ecwAvailable && ecwPractitioners.length === 0) {
      loadEcwPractitioners()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsEcwPractitioners, ecwAvailable])

  const reservedVisitTypesForRow = useCallback(
    (rowIndex: number) => {
      const reserved = new Set<string>()
      bookConfigs.forEach((row, index) => {
        if (index === rowIndex) return
        for (const vt of row.visitTypes) {
          reserved.add(vt.visitType.trim().toLowerCase())
        }
      })
      return reserved
    },
    [bookConfigs]
  )

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const schedulingBase = {
        readSource,
        writeSource,
        ...(readSource === 'open_dental' || writeSource === 'open_dental'
          ? {
              odReadSlotConfigs: readConfigs,
              odBookSlotConfigs: bookConfigs,
            }
          : {}),
        ...(readSource === 'ecw' || writeSource === 'ecw'
          ? {
              defaultReadPractitionerRef: null,
              defaultReadPractitionerRefs,
              defaultWritePractitionerRef:
                defaultWritePractitionerRef !== NONE ? defaultWritePractitionerRef : null,
              defaultReadLengthMinutes:
                defaultReadLengthMinutes !== NONE ? Number(defaultReadLengthMinutes) : null,
              defaultLengthMinutes,
            }
          : {}),
      }

      const scheduling =
        readSource === 'open_dental' || writeSource === 'open_dental'
          ? mirrorOdConfigsToLegacyDefaults(schedulingBase)
          : schedulingBase

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

  const addReadConfig = () => {
    const provNum = Number(readDraft.provNum)
    const lengthMinutes = Number(readDraft.lengthMinutes)
    if (!Number.isInteger(provNum) || provNum <= 0) {
      setError('Select a provider for the reading time slot row.')
      return
    }
    if (readDraft.operatoryNums.length === 0) {
      setError('Select at least one operatory for the reading time slot row.')
      return
    }
    setError('')
    setReadConfigs([
      ...readConfigs,
      { provNum, operatoryNums: readDraft.operatoryNums, lengthMinutes },
    ])
    setReadDraft(emptyReadDraft())
  }

  const addBookConfig = () => {
    const provNum = Number(bookDraft.provNum)
    const lengthMinutes = Number(bookDraft.lengthMinutes)
    if (!Number.isInteger(provNum) || provNum <= 0) {
      setError('Select a provider for the booking time slot row.')
      return
    }
    if (bookDraft.operatoryNums.length === 0) {
      setError('Select at least one operatory for the booking time slot row.')
      return
    }
    // Visit types are optional: empty = default booking target (any visit / voice book).
    setError('')
    setBookConfigs([
      ...bookConfigs,
      {
        provNum,
        operatoryNums: bookDraft.operatoryNums,
        lengthMinutes,
        visitTypes: bookDraft.visitTypes,
      },
    ])
    setBookDraft(emptyBookDraft())
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <CalendarClock className="h-5 w-5 text-gray-400" />
          Scheduling
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Configure availability checking and booking separately. A practice can read open slots
          from one system (e.g. Open Dental) while booking into another (e.g. Cal.com), or disable
          booking when write access is not available.
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="read-source" className="text-sm font-medium text-gray-700">
                  Availability source
                </label>
                <p className="text-xs text-gray-500">
                  Where open appointment slots are checked (voice agent, CRM booking UI, Healix).
                </p>
                <Select value={readSource} onValueChange={(v) => setReadSource(v as SchedulingSource)}>
                  <SelectTrigger id="read-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cal">Cal.com availability</SelectItem>
                    <SelectItem value="open_dental" disabled={!openDentalAvailable}>
                      Open Dental schedule{!openDentalAvailable ? ' (requires Open Dental)' : ''}
                    </SelectItem>
                    <SelectItem value="ecw" disabled={!ecwAvailable}>
                      eClinicalWorks (eCW){!ecwAvailable ? ' (requires FHIR / eCW connection)' : ''}
                    </SelectItem>
                    <SelectItem value="none">None (disable slot lookup)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="write-source" className="text-sm font-medium text-gray-700">
                  Booking destination
                </label>
                <p className="text-xs text-gray-500">
                  Where new appointments are written when staff or agents book a visit.
                </p>
                <Select value={writeSource} onValueChange={(v) => setWriteSource(v as SchedulingSource)}>
                  <SelectTrigger id="write-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cal">Cal.com scheduling</SelectItem>
                    <SelectItem value="open_dental" disabled={!openDentalAvailable}>
                      Open Dental schedule{!openDentalAvailable ? ' (requires Open Dental)' : ''}
                    </SelectItem>
                    <SelectItem value="ecw" disabled={!ecwAvailable}>
                      eClinicalWorks (eCW){!ecwAvailable ? ' (read-only until writeback enabled)' : ''}
                    </SelectItem>
                    <SelectItem value="none">None (read-only — no booking)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!openDentalAvailable && (readSource === 'open_dental' || writeSource === 'open_dental') && (
              <p className="text-xs text-amber-700">
                Set the clinical system to Open Dental above to use Open Dental for availability or
                booking.
              </p>
            )}

            {!ecwAvailable && (readSource === 'ecw' || writeSource === 'ecw') && (
              <p className="text-xs text-amber-700">
                Set the clinical system to FHIR / SMART on FHIR and connect eClinicalWorks backend
                services to use eCW for availability or appointment sync.
              </p>
            )}

            {writeSource === 'ecw' && (
              <p className="text-xs text-amber-700">
                Writing appointments directly into eClinicalWorks is not enabled yet. Use eCW as an
                availability source and book via Cal.com or Open Dental, or set booking to None.
              </p>
            )}

            {(readSource === 'ecw' || writeSource === 'ecw') && (
              <div className="space-y-4 rounded-md border border-gray-100 bg-gray-50 p-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">eClinicalWorks defaults</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Practitioners and visit length used when pulling Encounters (appointments) and
                    computing open slots from the eCW schedule. By default all practitioners are
                    included.
                  </p>
                </div>
                {loadingEcwPractitioners ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading eCW practitioners...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {readSource === 'ecw' && (
                      <>
                        <EcwPractitionerFilterEditor
                          practitioners={ecwPractitioners}
                          selectedRefs={defaultReadPractitionerRefs}
                          onChangeSelected={setDefaultReadPractitionerRefs}
                        />
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Default length</label>
                          <Select
                            value={defaultReadLengthMinutes}
                            onValueChange={setDefaultReadLengthMinutes}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="30 minutes" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Same as booking default</SelectItem>
                              {LENGTH_OPTIONS.map((m) => (
                                <SelectItem key={m} value={String(m)}>
                                  {m} minutes
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    {writeSource === 'ecw' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Booking practitioner
                        </label>
                        <Select
                          value={defaultWritePractitionerRef}
                          onValueChange={setDefaultWritePractitionerRef}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select practitioner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Same as reading default</SelectItem>
                            {ecwPractitioners.map((p) => (
                              <SelectItem key={p.reference} value={p.reference}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {readSource === 'open_dental' && (
              <div className="space-y-4 rounded-md border border-gray-100 bg-gray-50 p-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Reading time slots</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Providers and operatories used when checking available appointment slots. Slots
                    are unioned across each provider&apos;s operatories.
                  </p>
                </div>
                {loadingLists ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading providers and operatories...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {readConfigs.map((row, index) => (
                      <div
                        key={`read-${row.provNum}-${index}`}
                        className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_0.8fr_auto] gap-3 items-start rounded-md border border-gray-200 bg-white p-3"
                      >
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Provider</p>
                          <p className="text-sm font-medium text-gray-900">
                            {providerLabel(providers, row.provNum)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Operatories</p>
                          <p className="text-sm text-gray-800">
                            {row.operatoryNums.map((n) => operatoryLabel(operatories, n)).join(', ')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Length</p>
                          <p className="text-sm text-gray-800">{row.lengthMinutes} minutes</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setReadConfigs(readConfigs.filter((_, i) => i !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}

                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_0.8fr_auto] gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Provider</label>
                        <Select
                          value={readDraft.provNum}
                          onValueChange={(v) => setReadDraft((d) => ({ ...d, provNum: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Select provider</SelectItem>
                            {providers.map((p) => (
                              <SelectItem key={p.provNum} value={String(p.provNum)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Operatory</label>
                        <MultiOperatoryPicker
                          selected={readDraft.operatoryNums}
                          operatories={operatories}
                          onChange={(nums) => setReadDraft((d) => ({ ...d, operatoryNums: nums }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Appointment length</label>
                        <Select
                          value={readDraft.lengthMinutes}
                          onValueChange={(v) => setReadDraft((d) => ({ ...d, lengthMinutes: v }))}
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
                      <Button type="button" onClick={addReadConfig}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {writeSource === 'open_dental' && (
              <div className="space-y-4 rounded-md border border-gray-100 bg-gray-50 p-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Booking time slots</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Providers and write operatories used when booking. Visit types are optional —
                    leave them empty for a default booking target (same as before). Add visit types
                    and aliases when you want the voice agent to route different visits to different
                    providers/chairs.
                  </p>
                </div>
                {loadingLists ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading providers, operatories, and visit types...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookConfigs.map((row, index) => (
                      <div
                        key={`book-${row.provNum}-${index}`}
                        className="space-y-3 rounded-md border border-gray-200 bg-white p-3"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_0.8fr_auto] gap-3 items-start">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Provider</p>
                            <p className="text-sm font-medium text-gray-900">
                              {providerLabel(providers, row.provNum)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Operatories</p>
                            <MultiOperatoryPicker
                              selected={row.operatoryNums}
                              operatories={operatories}
                              onChange={(nums) =>
                                setBookConfigs(
                                  bookConfigs.map((r, i) =>
                                    i === index ? { ...r, operatoryNums: nums } : r
                                  )
                                )
                              }
                            />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Length</p>
                            <Select
                              value={String(row.lengthMinutes)}
                              onValueChange={(v) =>
                                setBookConfigs(
                                  bookConfigs.map((r, i) =>
                                    i === index ? { ...r, lengthMinutes: Number(v) } : r
                                  )
                                )
                              }
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setBookConfigs(bookConfigs.filter((_, i) => i !== index))}
                          >
                            Remove
                          </Button>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Visit types</p>
                          <SearchableVisitTypePicker
                            selected={row.visitTypes}
                            allVisitTypes={visitTypes}
                            reservedByOthers={reservedVisitTypesForRow(index)}
                            onChange={(next) =>
                              setBookConfigs(
                                bookConfigs.map((r, i) =>
                                  i === index ? { ...r, visitTypes: next } : r
                                )
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}

                    <div className="space-y-3 rounded-md border border-dashed border-gray-300 bg-white p-3">
                      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_0.8fr_auto] gap-3 items-end">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">Provider</label>
                          <Select
                            value={bookDraft.provNum}
                            onValueChange={(v) => setBookDraft((d) => ({ ...d, provNum: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Select provider</SelectItem>
                              {providers.map((p) => (
                                <SelectItem key={p.provNum} value={String(p.provNum)}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">Operatory</label>
                          <MultiOperatoryPicker
                            selected={bookDraft.operatoryNums}
                            operatories={operatories}
                            onChange={(nums) => setBookDraft((d) => ({ ...d, operatoryNums: nums }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">
                            Appointment length
                          </label>
                          <Select
                            value={bookDraft.lengthMinutes}
                            onValueChange={(v) => setBookDraft((d) => ({ ...d, lengthMinutes: v }))}
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
                        <Button type="button" onClick={addBookConfig}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Visit types</label>
                        <div className="mt-1">
                          <SearchableVisitTypePicker
                            selected={bookDraft.visitTypes}
                            allVisitTypes={visitTypes}
                            reservedByOthers={reservedVisitTypesForRow(-1)}
                            onChange={(next) => setBookDraft((d) => ({ ...d, visitTypes: next }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {writeSource === 'none' && readSource !== 'none' && (
              <p className="text-sm text-gray-600 rounded-md border border-blue-100 bg-blue-50 p-3">
                Availability can be checked from{' '}
                {readSource === 'open_dental'
                  ? 'Open Dental'
                  : readSource === 'ecw'
                    ? 'eClinicalWorks'
                    : 'Cal.com'}
                , but booking is disabled for this practice. Agents and staff can share open slots
                without writing appointments.
              </p>
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
