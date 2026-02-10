'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { computeInsuranceCompleteness, maskMemberId } from '@/lib/insurance-completeness'
import { InsurancePolicyFormModal } from './InsurancePolicyFormModal'
import { Shield, Plus, Pencil, Trash2, User, UserCircle } from 'lucide-react'

type InsurancePolicy = {
  id: string
  payerNameRaw: string
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
  onRefresh: () => void
}

export function InsuranceTab({
  patientId,
  practiceId,
  patient,
  policies,
  onRefresh,
}: InsuranceTabProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null)

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

  const handleModalSuccess = () => {
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Insurance</h2>
        <Button onClick={handleAdd} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Insurance
        </Button>
      </div>

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
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span>Member ID: {maskMemberId(policy.memberId)}</span>
                      {policy.groupNumber && (
                        <span>Group #: {policy.groupNumber}</span>
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
