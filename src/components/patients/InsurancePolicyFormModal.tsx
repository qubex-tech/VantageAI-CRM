'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  insurancePolicyFormSchema,
  insurancePlanTypeEnum,
  insuranceRelationshipEnum,
  type InsurancePolicyFormValues,
} from '@/lib/validations'
import { deriveBcbsAlphaPrefix } from '@/lib/insurance-completeness'
import { ChevronDown, ChevronUp, Upload } from 'lucide-react'

const PLAN_TYPES = insurancePlanTypeEnum.options
const RELATIONSHIPS = insuranceRelationshipEnum.options

type InsurancePolicy = {
  id: string
  payerNameRaw: string
  insurerPhoneRaw?: string | null
  memberId: string
  groupNumber?: string | null
  planName?: string | null
  planType?: string | null
  isPrimary: boolean
  subscriberIsPatient: boolean
  subscriberFirstName?: string | null
  subscriberLastName?: string | null
  subscriberDob?: Date | string | null
  relationshipToPatient?: string | null
  bcbsAlphaPrefix?: string | null
  bcbsStatePlan?: string | null
  cardFrontRef?: string | null
  cardBackRef?: string | null
  rxBin?: string | null
  rxPcn?: string | null
  rxGroup?: string | null
}

interface InsurancePolicyFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  practiceId: string
  policy?: InsurancePolicy | null
  onSuccess: () => void
}

const defaultValues: InsurancePolicyFormValues = {
  payerNameRaw: '',
  insurerPhone: '',
  memberId: '',
  groupNumber: '',
  planName: '',
  planType: null,
  isPrimary: true,
  subscriberIsPatient: true,
  subscriberFirstName: '',
  subscriberLastName: '',
  subscriberDob: null,
  relationshipToPatient: null,
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  bcbsAlphaPrefix: '',
  bcbsStatePlan: '',
  cardFrontRef: null,
  cardBackRef: null,
  rxBin: '',
  rxPcn: '',
  rxGroup: '',
}

function isBcbsPayer(name: string): boolean {
  const n = (name || '').toUpperCase()
  return n.includes('BCBS') || n.includes('BLUE CROSS')
}

export function InsurancePolicyFormModal({
  open,
  onOpenChange,
  patientId,
  practiceId,
  policy,
  onSuccess,
}: InsurancePolicyFormModalProps) {
  const [formValues, setFormValues] = useState<InsurancePolicyFormValues>(defaultValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)

  const isEdit = !!policy

  useEffect(() => {
    if (!open) return
    if (policy) {
      setFormValues({
        payerNameRaw: policy.payerNameRaw ?? '',
        insurerPhone: policy.insurerPhoneRaw ?? '',
        memberId: policy.memberId ?? '',
        groupNumber: policy.groupNumber ?? '',
        planName: policy.planName ?? '',
        planType: (policy.planType as InsurancePolicyFormValues['planType']) ?? null,
        isPrimary: policy.isPrimary,
        subscriberIsPatient: policy.subscriberIsPatient,
        subscriberFirstName: policy.subscriberFirstName ?? '',
        subscriberLastName: policy.subscriberLastName ?? '',
        subscriberDob: policy.subscriberDob
          ? new Date(policy.subscriberDob)
          : null,
        relationshipToPatient: (policy.relationshipToPatient as InsurancePolicyFormValues['relationshipToPatient']) ?? null,
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        bcbsAlphaPrefix: policy.bcbsAlphaPrefix ?? '',
        bcbsStatePlan: policy.bcbsStatePlan ?? '',
        cardFrontRef: policy.cardFrontRef ?? null,
        cardBackRef: policy.cardBackRef ?? null,
        rxBin: policy.rxBin ?? '',
        rxPcn: policy.rxPcn ?? '',
        rxGroup: policy.rxGroup ?? '',
      })
    } else {
      setFormValues(defaultValues)
    }
    setErrors({})
  }, [open, policy])

  const setValue = useCallback(<K extends keyof InsurancePolicyFormValues>(
    key: K,
    value: InsurancePolicyFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }))
  }, [errors])

  // When payer name or member ID changes and it's BCBS, suggest alpha prefix
  useEffect(() => {
    if (!isBcbsPayer(formValues.payerNameRaw) || !formValues.memberId) return
    const derived = deriveBcbsAlphaPrefix(formValues.memberId)
    if (derived && !formValues.bcbsAlphaPrefix) {
      setFormValues((prev) => ({ ...prev, bcbsAlphaPrefix: derived }))
    }
  }, [formValues.payerNameRaw, formValues.memberId])

  const handleUpload = useCallback(
    async (side: 'front' | 'back', file: File) => {
      const setUploading = side === 'front' ? setUploadingFront : setUploadingBack
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/insurance/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Upload failed')
        }
        const data = await res.json()
        const ref = data.ref as string
        setFormValues((prev) => ({
          ...prev,
          [side === 'front' ? 'cardFrontRef' : 'cardBackRef']: ref,
        }))
      } finally {
        setUploading(false)
      }
    },
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...formValues,
      patientId,
    }
    const result = insurancePolicyFormSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.flatten().fieldErrors &&
        Object.entries(result.error.flatten().fieldErrors).forEach(([k, v]) => {
          fieldErrors[k] = Array.isArray(v) ? v[0] ?? '' : String(v)
        })
      setErrors(fieldErrors)
      return
    }
    setSaving(true)
    setErrors({})
    try {
      if (isEdit) {
        const res = await fetch(`/api/insurance/${policy.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.data),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Failed to update policy')
        }
      } else {
        const res = await fetch('/api/insurance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...result.data, patientId }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Failed to add policy')
        }
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : 'Something went wrong',
      })
    } finally {
      setSaving(false)
    }
  }

  const showBcbs = isBcbsPayer(formValues.payerNameRaw)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Insurance' : 'Add Insurance'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.form && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors.form}
            </div>
          )}

          {/* Section A — Payer & Policy */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Payer & Policy</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="payerNameRaw">Payer name *</Label>
                <Input
                  id="payerNameRaw"
                  value={formValues.payerNameRaw}
                  onChange={(e) => setValue('payerNameRaw', e.target.value)}
                  placeholder="e.g. Aetna, BCBS of Texas"
                  className="mt-1"
                />
                {errors.payerNameRaw && (
                  <p className="mt-1 text-xs text-red-600">{errors.payerNameRaw}</p>
                )}
              </div>
              <div>
                <Label htmlFor="insurerPhone">Insurer phone</Label>
                <Input
                  id="insurerPhone"
                  value={formValues.insurerPhone ?? ''}
                  onChange={(e) => setValue('insurerPhone', e.target.value)}
                  placeholder="e.g. +1 (800) 555-0199"
                  className="mt-1"
                />
                {errors.insurerPhone && (
                  <p className="mt-1 text-xs text-red-600">{errors.insurerPhone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="memberId">Member ID / Policy # *</Label>
                <Input
                  id="memberId"
                  value={formValues.memberId}
                  onChange={(e) => setValue('memberId', e.target.value)}
                  placeholder="Member ID"
                  className="mt-1"
                />
                {errors.memberId && (
                  <p className="mt-1 text-xs text-red-600">{errors.memberId}</p>
                )}
              </div>
              <div>
                <Label htmlFor="groupNumber">Group #</Label>
                <Input
                  id="groupNumber"
                  value={formValues.groupNumber ?? ''}
                  onChange={(e) => setValue('groupNumber', e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="planName">Plan name</Label>
                <Input
                  id="planName"
                  value={formValues.planName ?? ''}
                  onChange={(e) => setValue('planName', e.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Plan type</Label>
                <Select
                  value={formValues.planType ?? ''}
                  onValueChange={(v) => setValue('planType', (v as InsurancePolicyFormValues['planType']) || null)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  id="isPrimary"
                  checked={formValues.isPrimary}
                  onCheckedChange={(v) => setValue('isPrimary', v)}
                />
                <Label htmlFor="isPrimary">Primary insurance</Label>
              </div>
            </div>
          </div>

          {/* Section B — Subscriber */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Subscriber / Policy holder</h3>
            <div className="flex items-center gap-2">
              <Switch
                id="subscriberIsPatient"
                checked={formValues.subscriberIsPatient}
                onCheckedChange={(v) => setValue('subscriberIsPatient', v)}
              />
              <Label htmlFor="subscriberIsPatient">Subscriber is the patient</Label>
            </div>
            {!formValues.subscriberIsPatient && (
              <div className="grid gap-3 sm:grid-cols-2 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div>
                  <Label htmlFor="subscriberFirstName">Subscriber first name *</Label>
                  <Input
                    id="subscriberFirstName"
                    value={formValues.subscriberFirstName ?? ''}
                    onChange={(e) => setValue('subscriberFirstName', e.target.value)}
                    className="mt-1"
                  />
                  {errors.subscriberFirstName && (
                    <p className="mt-1 text-xs text-red-600">{errors.subscriberFirstName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="subscriberLastName">Subscriber last name *</Label>
                  <Input
                    id="subscriberLastName"
                    value={formValues.subscriberLastName ?? ''}
                    onChange={(e) => setValue('subscriberLastName', e.target.value)}
                    className="mt-1"
                  />
                  {errors.subscriberLastName && (
                    <p className="mt-1 text-xs text-red-600">{errors.subscriberLastName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="subscriberDob">Subscriber date of birth *</Label>
                  <Input
                    id="subscriberDob"
                    type="date"
                    value={
                      formValues.subscriberDob
                        ? new Date(formValues.subscriberDob).toISOString().slice(0, 10)
                        : ''
                    }
                    onChange={(e) =>
                      setValue('subscriberDob', e.target.value ? new Date(e.target.value) : null)
                    }
                    className="mt-1"
                  />
                  {errors.subscriberDob && (
                    <p className="mt-1 text-xs text-red-600">{errors.subscriberDob}</p>
                  )}
                </div>
                <div>
                  <Label>Relationship to patient *</Label>
                  <Select
                    value={formValues.relationshipToPatient ?? ''}
                    onValueChange={(v) =>
                      setValue('relationshipToPatient', (v as InsurancePolicyFormValues['relationshipToPatient']) || null)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIPS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.relationshipToPatient && (
                    <p className="mt-1 text-xs text-red-600">{errors.relationshipToPatient}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section C — Patient address: used from patient profile for verification */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Patient address</h3>
            <p className="text-xs text-gray-500">
              Address is used from the patient profile for verification. Ensure the patient profile has address line 1, city, state, and ZIP (5-digit or ZIP+4) filled.
            </p>
          </div>

          {/* Section D — BCBS */}
          {showBcbs && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">BCBS routing</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bcbsAlphaPrefix">Alpha prefix</Label>
                  <Input
                    id="bcbsAlphaPrefix"
                    value={formValues.bcbsAlphaPrefix ?? ''}
                    onChange={(e) => setValue('bcbsAlphaPrefix', e.target.value)}
                    placeholder="Auto-derived from Member ID if possible"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bcbsStatePlan">BCBS State Plan</Label>
                  <Input
                    id="bcbsStatePlan"
                    value={formValues.bcbsStatePlan ?? ''}
                    onChange={(e) => setValue('bcbsStatePlan', e.target.value)}
                    placeholder="e.g. BCBS of Texas"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section E — Card uploads */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Insurance card</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Card front</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="cardFront"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload('front', f)
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingFront}
                    onClick={() => document.getElementById('cardFront')?.click()}
                  >
                    {uploadingFront ? 'Uploading…' : formValues.cardFrontRef ? 'Replace' : 'Upload'}
                    <Upload className="ml-2 h-4 w-4" />
                  </Button>
                  {formValues.cardFrontRef && (
                    <span className="text-xs text-gray-500 truncate">Saved</span>
                  )}
                </div>
              </div>
              <div>
                <Label>Card back</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="cardBack"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload('back', f)
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingBack}
                    onClick={() => document.getElementById('cardBack')?.click()}
                  >
                    {uploadingBack ? 'Uploading…' : formValues.cardBackRef ? 'Replace' : 'Upload'}
                    <Upload className="ml-2 h-4 w-4" />
                  </Button>
                  {formValues.cardBackRef && (
                    <span className="text-xs text-gray-500 truncate">Saved</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced */}
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="flex w-full items-center justify-between text-sm font-medium text-gray-700"
            >
              Advanced
              {advancedOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {advancedOpen && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="rxBin">Rx BIN</Label>
                  <Input
                    id="rxBin"
                    value={formValues.rxBin ?? ''}
                    onChange={(e) => setValue('rxBin', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="rxPcn">Rx PCN</Label>
                  <Input
                    id="rxPcn"
                    value={formValues.rxPcn ?? ''}
                    onChange={(e) => setValue('rxPcn', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="rxGroup">Rx Group</Label>
                  <Input
                    id="rxGroup"
                    value={formValues.rxGroup ?? ''}
                    onChange={(e) => setValue('rxGroup', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add insurance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
