'use client'

import type { RheumEligibilityPacket } from '@/lib/eligibility/rheum-packet'

function Field({
  label,
  value,
  unknown,
}: {
  label: string
  value?: string | null
  unknown?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">
        {value ? (
          value
        ) : (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
            {unknown ? 'Needs call' : 'Unknown'}
          </span>
        )}
      </dd>
    </div>
  )
}

function yn(value?: boolean | null): string | undefined {
  if (value == null) return undefined
  return value ? 'Yes' : 'No'
}

export function EligibilityOvPanel({
  packet,
  eligibilityStatus,
  compact,
}: {
  packet?: RheumEligibilityPacket | null
  eligibilityStatus?: string | null
  compact?: boolean
}) {
  if (!packet && !eligibilityStatus) return null

  const unknown = new Set(packet?.unknownFields || [])

  return (
    <div
      className={
        compact
          ? 'mt-3 rounded-md border border-gray-200 bg-gray-50/80 p-3'
          : 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-900">OV Benefit Verification</h4>
        {eligibilityStatus && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
            {eligibilityStatus}
          </span>
        )}
        {packet?.callRequired && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Call required
          </span>
        )}
        {packet?.source && (
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{packet.source}</span>
        )}
      </div>
      {packet?.callRequiredReason && (
        <p className="mb-2 text-xs text-amber-800">{packet.callRequiredReason}</p>
      )}
      {packet ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Plan type" value={packet.planType} unknown={unknown.has('planType')} />
          <Field
            label="Network"
            value={
              packet.networkStatus === 'inn'
                ? 'INN'
                : packet.networkStatus === 'onn'
                  ? 'ONN'
                  : undefined
            }
            unknown={unknown.has('networkStatus')}
          />
          <Field
            label="Specialist copay"
            value={packet.specialistCopay}
            unknown={unknown.has('specialistCopay')}
          />
          <Field
            label="Deductible (total / met / rem)"
            value={
              packet.deductible
                ? [packet.deductible.total, packet.deductible.met, packet.deductible.remaining]
                    .map((v) => v || '—')
                    .join(' / ')
                : undefined
            }
            unknown={unknown.has('deductible')}
          />
          <Field
            label="Coinsurance"
            value={packet.coinsurance}
            unknown={unknown.has('coinsurance')}
          />
          <Field
            label="OOP (max / rem)"
            value={
              packet.oop
                ? [packet.oop.max, packet.oop.remaining].map((v) => v || '—').join(' / ')
                : undefined
            }
            unknown={unknown.has('oop')}
          />
          <Field
            label="Referral required"
            value={yn(packet.referralRequired)}
            unknown={unknown.has('referralRequired')}
          />
          <Field
            label="Prior auth required"
            value={yn(packet.authRequired)}
            unknown={unknown.has('authRequired')}
          />
          <Field
            label="Telehealth allowed"
            value={yn(packet.telehealthAllowed)}
            unknown={unknown.has('telehealthAllowed')}
          />
        </dl>
      ) : (
        <p className="text-sm text-gray-600">No structured benefit fields captured yet.</p>
      )}
    </div>
  )
}
