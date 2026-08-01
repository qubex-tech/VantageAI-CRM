import type { BrowserPlaybook } from '../types'
import { availityEligibilityPlaybook } from './availity-eligibility'
import { smokePlaybook } from './smoke'

const PLAYBOOKS: BrowserPlaybook[] = [smokePlaybook, availityEligibilityPlaybook]

const byId = new Map(PLAYBOOKS.map((p) => [p.id, p]))

export function getPlaybook(playbookId: string): BrowserPlaybook | null {
  return byId.get(playbookId) || null
}

export function listPlaybooks(): Array<Pick<BrowserPlaybook, 'id' | 'site' | 'description'>> {
  return PLAYBOOKS.map(({ id, site, description }) => ({ id, site, description }))
}
