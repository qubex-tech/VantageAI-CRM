import { availityAdapter } from './availity-adapter'
import { stediAdapter } from './stedi-adapter'
import { getPracticeEligibilitySettings } from './settings'
import type { ClearinghouseAdapter } from './types'

const adapters: ClearinghouseAdapter[] = [availityAdapter, stediAdapter]

const byKey = new Map(adapters.map((adapter) => [adapter.vendorKey, adapter]))

export function listClearinghouseAdapters(): ClearinghouseAdapter[] {
  return [...adapters]
}

export function getClearinghouseAdapter(vendorKey: string): ClearinghouseAdapter {
  const adapter = byKey.get(vendorKey)
  if (!adapter) {
    const known = adapters.map((a) => a.vendorKey).join(', ')
    throw new Error(`Unknown eligibility vendor "${vendorKey}". Registered vendors: ${known}`)
  }
  return adapter
}

export async function getPracticeClearinghouseAdapter(
  practiceId: string
): Promise<ClearinghouseAdapter> {
  const settings = await getPracticeEligibilitySettings(practiceId)
  return getClearinghouseAdapter(settings.primaryVendorKey)
}

export { getPracticeEligibilitySettings, upsertPracticeEligibilitySettings } from './settings'
export { getPayerIdForVendor, upsertPayerIdMap } from './payer-ids'
export {
  pickConfidentPayerMatch,
  resolvePayerIdFromName,
} from './match-payer-from-name'
export { mapToCanonicalEligibilityRequest, redactCanonicalRequest } from './canonical-request'
export type {
  CanonicalEligibilityRequest,
  CanonicalEligibilityResult,
  ClearinghouseAdapter,
  PayerSearchResult,
  PracticeEligibilityConfig,
} from './types'
