'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { computeInsuranceCompleteness, maskMemberId } from '@/lib/insurance-completeness'
import { InsurancePolicyFormModal } from './InsurancePolicyFormModal'
import { Shield, Plus, Pencil, Trash2, User, UserCircle, RefreshCw, CheckCircle2 } from 'lucide-react'

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
  availityPayerId?: string | null
  eligibilityStatus?: string | null
  lastEligibilityCheckedAt?: Date | string | null
}

type EligibilityCheckSummary = {
  id: string
  status: string
  errorMessage?: string | null
  parsedSummary?: { eligibilityStatus?: string } | null
  createdAt: string
  policy?: { payerNameRaw?: string }
}

type Patient = {
  id: string
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  dateOfBirth?: Date | string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}

interface InsuranceTabProps {
  patientId: string
  practiceId: string
  patient: Patient
  policies: InsurancePolicy[]
  externalEhrId?: string | null
  onRefresh: () => void
}

function eligibilityBadge(status?: string | null) {
  if (!status) return null
  const normalized = status.toLowerCase()
  if (normalized === 'active') {
    return (
      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Eligible
      </span>
    )
  }
  if (normalized === 'inactive') {
    return (
      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Inactive
      </span>
    )
  }
  if (normalized === 'pending' || normalized === 'in_progress') {
    return (
      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        Checking…
      </span>
    )
  }
  if (normalized === 'error' || normalized === 'failed') {
    return (
      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Check failed
      </span>
    )
  }
  return (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {status}
    </span>
  )
}

export function InsuranceTab({
  patientId,
  practiceId,
  patient,
  policies,
  externalEhrId,
  onRefresh,
}: InsuranceTabProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [checkingPolicyId, setCheckingPolicyId] = useState<string | null>(null)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)
  const [recentChecks, setRecentChecks] = useState<EligibilityCheckSummary[]>([])
  const autoSyncAttempted = useRef(false)

  const loadRecentChecks = useCallback(async () => {
    try {
      const res = await fetch(`/api/insurance/eligibility-check?patientId=${patientId}`)
      if (!res.ok) return
      const data = await res.json()
      setRecentChecks(data.checks || [])
    } catch {
      // non-blocking
    }
  }, [patientId])

  useEffect(() => {
    void loadRecentChecks()
  }, [loadRecentChecks, policies])

  const syncFromEhr = useCallback(async () => {
    if (!externalEhrId?.trim()) {
      setSyncError('Patient is not linked to eCW.')
      return
    }
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/patients/${patientId}/insurance/sync-from-ehr`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Sync failed (${res.status})`)
      }
      onRefresh()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync from eCW')
    } finally {
      setSyncing(false)
    }
  }, [externalEhrId, patientId, onRefresh])

  useEffect(() => {
    if (!externalEhrId?.trim() || autoSyncAttempted.current) return
    autoSyncAttempted.current = true
    void syncFromEhr()
  }, [externalEhrId, syncFromEhr])

  const sortedPolicies = [...policies].sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1))

  const handleAdd = () => {
    setEditingPolicy(null)
    setModalOpen(true)
  }

  const handleEdit = (policy: InsurancePolicy) => {
    setEditingPolicy(policy)
    setModalOpen(true)
  }

  const handleDelete = async (policy: InsurancePolicy) => {
    if (!confirm(`Remove insurance "${policy.payerNameRaw}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/insurance/${policy.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to delete')
      }
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete policy')
    }
  }

  const handleCheckEligibility = async (policy: InsurancePolicy) => {
    setCheckingPolicyId(policy.id)
    setCheckMessage(null)
    try {
      const res = await fetch('/api/insurance/eligibility-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, policyId: policy.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Eligibility check failed')
      }
      setCheckMessage(data.message || 'Eligibility check started')
      await loadRecentChecks()
      onRefresh()

      const checkId = data.eligibility?.eligibilityCheckId
      if (checkId && (data.path === 'availity_in_progress' || data.eligibility?.status === 'in_progress')) {
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 3000))
          const poll = await fetch(`/api/insurance/eligibility-check/${checkId}`)
          if (!poll.ok) break
          const pollData = await poll.json()
          const status = pollData.check?.status
          if (status === 'complete' || status === 'failed' || status === 'fallback_voice') {
            setCheckMessage(
              status === 'complete'
                ? 'Eligibility check completed'
                : status === 'fallback_voice'
                  ? 'Availity check failed — voice verification started'
                  : pollData.check?.errorMessage || 'Eligibility check failed'
            )
            await loadRecentChecks()
            onRefresh()
            break
          }
        }
      }
    } catch (err) {
      setCheckMessage(err instanceof Error ? err.message : 'Eligibility check failed')
    } finally {
      setCheckingPolicyId(null)
    }
  }

  const handleModalSuccess = () => {
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Insurance</h2>
        <div className="flex flex-wrap items-center gap-2">
          {externalEhrId?.trim() && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void syncFromEhr()}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing from eCW…' : 'Sync from eCW'}
            </Button>
          )}
          <Button onClick={handleAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Insurance
          </Button>
        </div>
      </div>

      {syncError && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {syncError}
        </p>
      )}

      {checkMessage && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {checkMessage}
        </p>
      )}

      {sortedPolicies.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-8 text-center">
          <Shield className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">No insurance policies yet</p>
          <p className="mt-1 text-xs text-gray-500">Add insurance to capture information for eligibility verification.</p>
          <Button onClick={handleAdd} variant="outline" size="sm" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Add Insurance
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {sortedPolicies.map((policy) => {
            const completeness = computeInsuranceCompleteness(policy, patient)
            return (
              <li
                key={policy.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{policy.payerNameRaw}</span>
                      {policy.isPrimary && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Primary
                        </span>
                      )}
                      {completeness.status === 'ready' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          ✅ Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          ⚠️ Missing info
                        </span>
                      )}
                      {eligibilityBadge(policy.eligibilityStatus)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span>Member ID: {maskMemberId(policy.memberId)}</span>
                      {policy.insurerPhoneRaw && <span>Insurer phone: {policy.insurerPhoneRaw}</span>}
                      {policy.availityPayerId && <span>Availity payer: {policy.availityPayerId}</span>}
                      {policy.groupNumber && (
                        <span>Group #: {policy.groupNumber}</span>
                      )}
                      {policy.planName && <span>Plan: {policy.planName}</span>}
                      {policy.lastEligibilityCheckedAt && (
                        <span>
                          Last checked: {new Date(policy.lastEligibilityCheckedAt).toLocaleString()}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        Subscriber: {policy.subscriberIsPatient ? (
                          <>
                            <User className="h-3.5 w-3" /> Self
                          </>
                        ) : (
                          <>
                            <UserCircle className="h-3.5 w-3" /> Other
                          </>
                        )}
                      </span>
                    </div>
                    {completeness.missingFields.length > 0 && (
                      <div className="mt-2 text-xs text-amber-700">
                        Missing: {completeness.missingFields.join(', ')}
                      </div>
                    )}
                    {completeness.warnings.length > 0 && completeness.missingFields.length === 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Recommended: {completeness.warnings.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCheckEligibility(policy)}
                      disabled={checkingPolicyId === policy.id}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {checkingPolicyId === policy.id ? 'Checking…' : 'Check eligibility'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(policy)}
                      className="gap-1"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(policy)}
                      className="gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {recentChecks.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Recent eligibility checks</h3>
          <ul className="mt-2 space-y-2">
            {recentChecks.slice(0, 5).map((check) => (
              <li key={check.id} className="text-sm text-gray-600">
                {new Date(check.createdAt).toLocaleString()} — {check.policy?.payerNameRaw || 'Policy'}:{' '}
                {check.status}
                {check.parsedSummary?.eligibilityStatus
                  ? ` (${check.parsedSummary.eligibilityStatus})`
                  : ''}
                {check.errorMessage ? ` — ${check.errorMessage}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <InsurancePolicyFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        patientId={patientId}
        practiceId={practiceId}
        policy={editingPolicy}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
