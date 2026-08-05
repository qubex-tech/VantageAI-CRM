/** Credentials-only exports — safe for Next.js API routes (no Playwright). */
export { getBrowserCredential, upsertBrowserCredential, redactBrowserCredential } from './credentials'
export { generateTotp } from './totp'
export type {
  BrowserPlaybook,
  BrowserAgentRunStatus,
  PlaybookResult,
  StartBrowserAgentRunInput,
} from './types'

/**
 * Heavy runtime exports (Inngest / scripts). Importing these may pull Playwright
 * via dynamic import at runtime; keep API routes on the credentials exports above.
 */
export { isBrowserbaseConfigured } from './session'
export { startBrowserAgentRun, executeBrowserAgentRun } from './runner'
export { getPlaybook, listPlaybooks } from './playbooks'
export {
  AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
  getDefaultAvailityEligibilityConfig,
  getOrCreatePracticePlaybook,
  getPracticePlaybook,
  normalizeAvailityEligibilityConfig,
  updatePracticePlaybookConfig,
} from './practice-playbook'
export type { AvailityEligibilityPlaybookConfig, PracticePlaybookRecord } from './practice-playbook'
export {
  runAvailityRpaEligibility,
  isAvailityRpaAvailable,
  applyBrowserRunToEligibilityCheck,
} from './run-availity-rpa'
