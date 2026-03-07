import { EhrProvider, EhrProviderId } from '../types'
import { ecwProvider } from './ecw'
import { ecwBulkProvider } from './ecwBulk'
import { ecwWriteProvider } from './ecwWrite'
import { pccProvider } from './pcc'
import { genericSmartProvider } from './genericSmart'

const providers: EhrProvider[] = [
  ecwProvider,
  ecwBulkProvider,
  ecwWriteProvider,
  pccProvider,
  genericSmartProvider,
]

export function getProvider(providerId: EhrProviderId): EhrProvider {
  const provider = providers.find((entry) => entry.id === providerId)
  if (!provider) {
    throw new Error(`Unsupported EHR provider: ${providerId}`)
  }
  return provider
}

export function listProviders(): EhrProvider[] {
  return providers.slice()
}
