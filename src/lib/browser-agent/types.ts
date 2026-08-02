/** Minimal page surface used by playbooks (avoids importing playwright-core types into Next bundles). */
export interface BrowserPage {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>
  title: () => Promise<string>
  url: () => string
  locator: (selector: string) => BrowserLocator
  getByRole: (role: string, options?: { name?: RegExp | string }) => BrowserLocator
  waitForLoadState: (state?: string, options?: Record<string, unknown>) => Promise<unknown>
  waitForTimeout: (ms: number) => Promise<void>
  screenshot: (options?: Record<string, unknown>) => Promise<Buffer>
  keyboard?: { type: (text: string, options?: { delay?: number }) => Promise<void> }
}

export interface BrowserLocator {
  first: () => BrowserLocator
  count: () => Promise<number>
  fill: (value: string) => Promise<void>
  click: (options?: Record<string, unknown>) => Promise<void>
  innerText: () => Promise<string>
}

export type BrowserAgentRunStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled'

export interface BrowserSessionHandle {
  sessionId: string
  page: BrowserPage
  close: () => Promise<void>
  screenshotDataUrl?: () => Promise<string>
}

export interface DecryptedBrowserCredential {
  id: string
  practiceId: string
  site: string
  username: string
  password: string
  totpSecret: string | null
  extra: Record<string, unknown> | null
}

export interface PlaybookContext {
  practiceId: string
  runId: string
  credential: DecryptedBrowserCredential | null
  useMock: boolean
  input: Record<string, unknown>
  session: BrowserSessionHandle | null
  log: (message: string, meta?: Record<string, unknown>) => void
}

export interface PlaybookResult {
  ok: boolean
  output?: Record<string, unknown>
  errorMessage?: string
  artifactUrls?: string[]
  /** Soft failure that should fall through to voice (e.g. MFA wall) */
  escalateToVoice?: boolean
}

export interface BrowserPlaybook {
  id: string
  site: string
  description: string
  /** When true, runner opens a Browserbase/Playwright session before calling run */
  requiresBrowser: boolean
  run: (ctx: PlaybookContext) => Promise<PlaybookResult>
}

export interface StartBrowserAgentRunInput {
  practiceId: string
  playbookId: string
  input: Record<string, unknown>
  eligibilityCheckId?: string
  useMock?: boolean
  /** Skip Inngest and execute inline (scripts / mock) */
  sync?: boolean
}
