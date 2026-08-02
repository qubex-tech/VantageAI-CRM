import type { AvailityPlan } from '@/lib/availity/types'
import {
  createEmptyRheumPacket,
  finalizeRheumPacket,
  parseTriStateFlag,
  type EligibilityFormMode,
  type EligibilityNetworkStatus,
  type RheumEligibilityPacket,
} from './rheum-packet'

function asAmountString(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (obj.amount != null) return asAmountString(obj.amount)
    if (obj.value != null) return asAmountString(obj.value)
  }
  return undefined
}

function readAmountBucket(amounts: Record<string, unknown> | undefined, keys: string[]) {
  if (!amounts) return undefined
  for (const key of keys) {
    const hit = amounts[key]
    if (hit != null) return hit
  }
  // case-insensitive fallback
  const lowerMap = new Map(Object.keys(amounts).map((k) => [k.toLowerCase(), amounts[k]]))
  for (const key of keys) {
    const hit = lowerMap.get(key.toLowerCase())
    if (hit != null) return hit
  }
  return undefined
}

function moneyFromBucket(bucket: unknown): { total?: string; remaining?: string; met?: string } {
  if (bucket == null) return {}
  if (typeof bucket !== 'object') {
    const total = asAmountString(bucket)
    return total ? { total } : {}
  }
  const obj = bucket as Record<string, unknown>
  const total = asAmountString(obj.amount ?? obj.total ?? obj.value)
  const remaining = asAmountString(obj.remaining ?? obj.remainder ?? obj.balance)
  const met = asAmountString(obj.met ?? obj.accumulated ?? obj.ytd)
  return { total, remaining, met }
}

function benefitScore(name: string, type?: string): number {
  const text = `${name} ${type || ''}`.toLowerCase()
  let score = 0
  if (/specialist/.test(text)) score += 50
  if (/professional|physician|office visit|outpatient/.test(text)) score += 30
  if (/health benefit plan|30\b/.test(text)) score += 20
  if (/primary care|pcp/.test(text)) score += 5
  if (/pharmacy|rx|dental|vision/.test(text)) score -= 20
  return score
}

function inferPlanType(plan?: AvailityPlan): string | undefined {
  const raw = [plan?.insuranceType, plan?.description, plan?.groupName, plan?.insuranceTypeCode]
    .filter(Boolean)
    .join(' ')
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (/\bppo\b|preferred provider/.test(lower)) return 'PPO'
  if (/\bhmo\b|health maintenance/.test(lower)) return 'HMO'
  if (/medicare advantage|\bma\b|part c/.test(lower)) return 'Medicare Advantage'
  if (/marketplace|exchange|aca/.test(lower)) return 'Marketplace'
  if (/medicaid/.test(lower)) return 'Medicaid'
  if (/medicare/.test(lower)) return 'Medicare'
  if (/commercial/.test(lower)) return 'Commercial'
  return plan?.insuranceType || plan?.description || undefined
}

function inferNetwork(text: string): EligibilityNetworkStatus {
  const lower = text.toLowerCase()
  if (/out[- ]of[- ]network|\bonn\b|non[- ]participating/.test(lower)) return 'onn'
  if (/in[- ]network|\binn\b|participating provider/.test(lower)) return 'inn'
  return 'unknown'
}

/**
 * Build a Lonestar OV rheum packet from Availity plan benefit amounts.
 */
export function buildRheumPacketFromAvailityPlans(
  plans: AvailityPlan[],
  opts?: {
    formMode?: EligibilityFormMode
    source?: RheumEligibilityPacket['source']
    pageText?: string
  }
): RheumEligibilityPacket {
  const formMode = opts?.formMode || 'office_visit'
  const packet = createEmptyRheumPacket(formMode, opts?.source || 'availity_api')
  const primary = plans[0]
  packet.planType = inferPlanType(primary)

  const benefits = plans.flatMap((p) => p.benefits || [])
  const ranked = [...benefits].sort(
    (a, b) =>
      benefitScore(b.name || b.type || '', b.type) - benefitScore(a.name || a.type || '', a.type)
  )

  const preferred = ranked[0]
  const amounts = (preferred?.amounts || {}) as Record<string, unknown>
  const allAmountsText = JSON.stringify(benefits.map((b) => b.amounts || {}))

  const copayBucket = readAmountBucket(amounts, [
    'coPayment',
    'copayment',
    'copay',
    'coPay',
    'co_pay',
  ])
  const deductibleBucket = readAmountBucket(amounts, ['deductible', 'deduct'])
  const coinsBucket = readAmountBucket(amounts, [
    'coInsurance',
    'coinsurance',
    'coins',
    'co_insurance',
  ])
  const oopBucket = readAmountBucket(amounts, [
    'outOfPocket',
    'outOfPocketMax',
    'oop',
    'oopMax',
    'maximumOutOfPocket',
  ])

  // Also scan other benefit rows if preferred lacked amounts
  for (const b of ranked.slice(1)) {
    const a = (b.amounts || {}) as Record<string, unknown>
    if (!copayBucket) {
      const c = readAmountBucket(a, ['coPayment', 'copayment', 'copay', 'coPay'])
      if (c) Object.assign(amounts, { coPayment: c })
    }
    if (!deductibleBucket) {
      const d = readAmountBucket(a, ['deductible'])
      if (d) Object.assign(amounts, { deductible: d })
    }
    if (!coinsBucket) {
      const c = readAmountBucket(a, ['coInsurance', 'coinsurance'])
      if (c) Object.assign(amounts, { coInsurance: c })
    }
    if (!oopBucket) {
      const o = readAmountBucket(a, ['outOfPocket', 'oop', 'outOfPocketMax'])
      if (o) Object.assign(amounts, { outOfPocket: o })
    }
  }

  const copay = moneyFromBucket(
    readAmountBucket(amounts, ['coPayment', 'copayment', 'copay', 'coPay'])
  )
  const deductible = moneyFromBucket(readAmountBucket(amounts, ['deductible', 'deduct']))
  const coins = moneyFromBucket(
    readAmountBucket(amounts, ['coInsurance', 'coinsurance', 'coins'])
  )
  const oop = moneyFromBucket(
    readAmountBucket(amounts, ['outOfPocket', 'outOfPocketMax', 'oop', 'oopMax'])
  )

  if (copay.total) packet.specialistCopay = copay.total.includes('%') ? copay.total : `$${copay.total}`
  if (deductible.total || deductible.remaining || deductible.met) {
    packet.deductible = {
      total: deductible.total ? `$${deductible.total}` : undefined,
      remaining: deductible.remaining ? `$${deductible.remaining}` : undefined,
      met: deductible.met ? `$${deductible.met}` : undefined,
    }
  }
  if (coins.total) {
    packet.coinsurance = /%/.test(coins.total) ? coins.total : `${coins.total}%`
  }
  if (oop.total || oop.remaining) {
    packet.oop = {
      max: oop.total ? `$${oop.total}` : undefined,
      remaining: oop.remaining ? `$${oop.remaining}` : undefined,
    }
  }

  const blob = `${allAmountsText} ${opts?.pageText || ''} ${benefits
    .map((b) => `${b.name} ${b.status} ${b.type}`)
    .join(' ')}`

  packet.networkStatus = inferNetwork(blob)
  packet.referralRequired = parseTriStateFlag(
    blob,
    /referral\s*(required|needed|yes)|requires?\s+referral/i,
    /no\s+referral|referral\s*(not required|waived)/i
  )
  packet.authRequired = parseTriStateFlag(
    blob,
    /prior\s*auth(orization)?\s*(required|needed|yes)|authorization\s*required/i,
    /no\s+prior\s*auth|prior\s*auth(orization)?\s*(not required|waived)/i
  )
  packet.precertRequired = parseTriStateFlag(
    blob,
    /pre-?cert(ification)?\s*(required|needed|yes)/i,
    /no\s+pre-?cert|pre-?cert(ification)?\s*(not required|waived)/i
  )
  packet.telehealthAllowed = parseTriStateFlag(
    blob,
    /telehealth\s*(covered|allowed|yes)|telemedicine\s*(covered|allowed)/i,
    /telehealth\s*(not covered|not allowed|no)|telemedicine\s*(not covered)/i
  )

  packet.verifiedBy = 'Availity'
  return finalizeRheumPacket(packet)
}
