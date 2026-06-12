import type { OdDateTime } from '../models/common'

export type SignalodRecord = {
  SignalodNum?: number
  SigDateTime?: OdDateTime
  FKey?: number
  FKeyType?: string
  ItemName?: string
  [key: string]: unknown
}

export type WatchSignalodsOptions = {
  since?: OdDateTime | string
  types?: string[]
  params?: Record<string, string | number | boolean | undefined | null>
}

export type SignalodsWatcher = {
  list: (params?: Record<string, string | number | boolean | undefined | null>) => Promise<SignalodRecord[]>
}

export async function watchSignalods(
  signalods: SignalodsWatcher,
  options: WatchSignalodsOptions = {}
): Promise<SignalodRecord[]> {
  const params: Record<string, string | number | boolean | undefined | null> = {
    ...options.params,
  }
  if (options.since) {
    params.SigDateTime = options.since
  }

  const records = await signalods.list(params)
  if (!options.types?.length) return records

  const typeSet = new Set(options.types.map((t) => t.toLowerCase()))
  return records.filter((r) => {
    const itemName = typeof r.ItemName === 'string' ? r.ItemName.toLowerCase() : ''
    const fKeyType = typeof r.FKeyType === 'string' ? r.FKeyType.toLowerCase() : ''
    return typeSet.has(itemName) || typeSet.has(fKeyType)
  })
}
