'use client'

import type { ReactNode } from 'react'
import type { EligibilityCoverageDetail, ParsedEligibilitySummary } from '@/lib/availity/types'
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

function moneyPair(pair?: { total?: string; remaining?: string }): string | undefined {
  if (!pair?.total && !pair?.remaining) return undefined
  if (pair.total && pair.remaining) return `${pair.total} total · ${pair.remaining} remaining`
  return pair.total || pair.remaining
}

function formatDisplayDate(value?: string): string | undefined {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function sourceBadge(source?: string | null): string | null {
  if (!source) return null
  if (source === 'stedi_api' || source === 'clearinghouse_api') return null
  if (source === 'availity_api') return 'API'
  if (source === 'availity_rpa') return 'Portal'
  if (source === 'voice') return 'Call'
  if (source === 'medicare_tx_nonpar') return 'Medicare TX'
  if (source === 'manual') return 'Manual'
  return null
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h5>
      {children}
    </div>
  )
}

function CostTable({
  rows,
}: {
  rows?: Array<{ services: string; amount: string; network: 'INN' | 'OON' }>
}) {
  if (!rows?.length) return null
  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-white text-xs text-gray-500">
          <tr>
            <th className="px-2 py-1.5 font-medium">Service</th>
            <th className="px-2 py-1.5 font-medium">Network</th>
            <th className="px-2 py-1.5 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.network}-${row.amount}-${row.services}-${index}`} className="border-t border-gray-100">
              <td className="px-2 py-1.5 align-top text-gray-900">{row.services}</td>
              <td className="px-2 py-1.5 align-top text-gray-600">{row.network}</td>
              <td className="whitespace-nowrap px-2 py-1.5 align-top font-medium text-gray-900">{row.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OptionalField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return <Field label={label} value={value} />
}

function CoverageSnapshot({ detail }: { detail: EligibilityCoverageDetail }) {
  const subscriberName = [detail.subscriber?.firstName, detail.subscriber?.lastName]
    .filter(Boolean)
    .join(' ')
  const planType = detail.insuranceType || detail.planType
  const showInnOon = Boolean(detail.inn || detail.oon)
  return (
    <>
      <Section title="Plan">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <OptionalField label="Payer" value={detail.payerName} />
          <OptionalField label="Payer ID" value={detail.payerId} />
          <OptionalField label="Plan" value={detail.planName} />
          <OptionalField label="Plan type" value={planType} />
          <OptionalField label="Group" value={detail.groupNumber} />
          <OptionalField label="Plan #" value={detail.planNumber} />
          <OptionalField label="Coverage level" value={detail.coverageLevel} />
          <OptionalField label="Member status" value={detail.memberStatus} />
          <OptionalField label="Plan description" value={detail.planDescription} />
          <OptionalField label="Coverage start" value={formatDisplayDate(detail.coverageStartDate)} />
          <OptionalField label="Coverage end" value={formatDisplayDate(detail.coverageEndDate)} />
          <OptionalField label="Eligibility start" value={formatDisplayDate(detail.eligibilityStartDate)} />
          <OptionalField label="Eligibility end" value={formatDisplayDate(detail.eligibilityEndDate)} />
          <OptionalField label="As of" value={formatDisplayDate(detail.serviceDate)} />
          <OptionalField label="Reference #" value={detail.referenceNumber} />
        </dl>
      </Section>

      {showInnOon && (
        <Section title="In-network vs out-of-network">
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-xs text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 font-medium"> </th>
                  <th className="px-2 py-1.5 font-medium">In-network</th>
                  <th className="px-2 py-1.5 font-medium">Out-of-network</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-500">Deductible</td>
                  <td className="px-2 py-1.5 text-gray-900">{moneyPair(detail.inn?.deductible) || '—'}</td>
                  <td className="px-2 py-1.5 text-gray-900">{moneyPair(detail.oon?.deductible) || '—'}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-500">Out-of-pocket max</td>
                  <td className="px-2 py-1.5 text-gray-900">{moneyPair(detail.inn?.oop) || '—'}</td>
                  <td className="px-2 py-1.5 text-gray-900">{moneyPair(detail.oon?.oop) || '—'}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-500">Office copay</td>
                  <td className="px-2 py-1.5 text-gray-900">{detail.inn?.officeCopay || '—'}</td>
                  <td className="px-2 py-1.5 text-gray-900">{detail.oon?.officeCopay || '—'}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-500">Office coinsurance</td>
                  <td className="px-2 py-1.5 text-gray-900">{detail.inn?.officeCoinsurance || '—'}</td>
                  <td className="px-2 py-1.5 text-gray-900">{detail.oon?.officeCoinsurance || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {detail.copays && detail.copays.length > 0 && (
        <Section title="Copays">
          <CostTable rows={detail.copays} />
        </Section>
      )}

      {detail.coinsuranceLines && detail.coinsuranceLines.length > 0 && (
        <Section title="Coinsurance">
          <CostTable rows={detail.coinsuranceLines} />
        </Section>
      )}

      {detail.coveredServices && detail.coveredServices.length > 0 && (
        <Section title="Covered services">
          <div className="flex flex-wrap gap-1.5">
            {detail.coveredServices.map((service) => (
              <span
                key={service}
                className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 ring-1 ring-gray-200"
              >
                {service}
              </span>
            ))}
          </div>
        </Section>
      )}

      {detail.subscriber && (subscriberName || detail.subscriber.address || detail.subscriber.memberId) && (
        <Section title="Subscriber on file with payer">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <OptionalField label="Name" value={subscriberName || undefined} />
            <OptionalField label="Member ID" value={detail.subscriber.memberId} />
            <OptionalField label="Date of birth" value={formatDisplayDate(detail.subscriber.dateOfBirth)} />
            <OptionalField label="Gender" value={detail.subscriber.gender} />
            <OptionalField label="Address" value={detail.subscriber.address} />
            <OptionalField label="Group" value={detail.subscriber.groupNumber} />
          </dl>
        </Section>
      )}

      {detail.payerCorrespondence && (detail.payerCorrespondence.name || detail.payerCorrespondence.address) && (
        <Section title="Payer correspondence">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <OptionalField label="Name" value={detail.payerCorrespondence.name} />
            <OptionalField label="Address" value={detail.payerCorrespondence.address} />
          </dl>
        </Section>
      )}
    </>
  )
}

export function EligibilityOvPanel({
  packet,
  eligibilityStatus,
  coverageDetail,
  summary,
  compact,
}: {
  packet?: RheumEligibilityPacket | null
  eligibilityStatus?: string | null
  coverageDetail?: EligibilityCoverageDetail | null
  summary?: ParsedEligibilitySummary | null
  compact?: boolean
}) {
  const rheum = packet || summary?.rheum
  const detail = coverageDetail || summary?.coverageDetail
  const status = eligibilityStatus || summary?.eligibilityStatus
  if (!rheum && !status && !detail) return null

  const unknown = new Set(rheum?.unknownFields || [])
  const badge = sourceBadge(rheum?.source)

  return (
    <div
      className={
        compact
          ? 'mt-3 rounded-md border border-gray-200 bg-gray-50/80 p-3'
          : 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-900">Benefit verification</h4>
        {status && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
            {status}
          </span>
        )}
        {rheum?.callRequired && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Call required
          </span>
        )}
        {badge && (
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{badge}</span>
        )}
      </div>
      {rheum?.callRequiredReason && (
        <p className="mb-2 text-xs text-amber-800">{rheum.callRequiredReason}</p>
      )}

      {detail ? (
        <CoverageSnapshot detail={detail} />
      ) : rheum ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Plan type" value={rheum.planType} unknown={unknown.has('planType')} />
          <Field
            label="Network"
            value={
              rheum.networkStatus === 'inn'
                ? 'INN'
                : rheum.networkStatus === 'onn'
                  ? 'ONN'
                  : undefined
            }
            unknown={unknown.has('networkStatus')}
          />
          <Field
            label="Specialist copay"
            value={rheum.specialistCopay}
            unknown={unknown.has('specialistCopay')}
          />
          <Field
            label="Deductible (total / met / rem)"
            value={
              rheum.deductible
                ? [rheum.deductible.total, rheum.deductible.met, rheum.deductible.remaining]
                    .map((v) => v || '—')
                    .join(' / ')
                : undefined
            }
            unknown={unknown.has('deductible')}
          />
          <Field
            label="Coinsurance"
            value={rheum.coinsurance}
            unknown={unknown.has('coinsurance')}
          />
          <Field
            label="OOP (max / rem)"
            value={
              rheum.oop
                ? [rheum.oop.max, rheum.oop.remaining].map((v) => v || '—').join(' / ')
                : undefined
            }
            unknown={unknown.has('oop')}
          />
          <Field
            label="Referral required"
            value={yn(rheum.referralRequired)}
            unknown={unknown.has('referralRequired')}
          />
          <Field
            label="Prior auth required"
            value={yn(rheum.authRequired)}
            unknown={unknown.has('authRequired')}
          />
          <Field
            label="Telehealth allowed"
            value={yn(rheum.telehealthAllowed)}
            unknown={unknown.has('telehealthAllowed')}
          />
        </dl>
      ) : (
        <p className="text-sm text-gray-600">No structured benefit fields captured yet.</p>
      )}
    </div>
  )
}
