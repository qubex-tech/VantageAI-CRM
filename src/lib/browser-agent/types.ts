/** Minimal page surface used by playbooks (avoids importing playwright-core types into Next bundles). */
export interface BrowserPage {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>
  title: () => Promise<string>
  url: () => string
  locator: (selector: string) => BrowserLocator
  getByRole: (role: string, options?: { name?: RegExp | string }) => BrowserLocator
  getByLabel?: (text: string | RegExp, options?: Record<string, unknown>) => BrowserLocator
  getByText?: (text: string | RegExp, options?: Record<string, unknown>) => BrowserLocator
  frameLocator?: (selector: string) => { locator: (selector: string) => BrowserLocator }
  waitForLoadState: (state?: string, options?: Record<string, unknown>) => Promise<unknown>
  waitForTimeout: (ms: number) => Promise<void>
  screenshot: (options?: Record<string, unknown>) => Promise<Buffer>
  keyboard?: {
    type: (text: string, options?: { delay?: number }) => Promise<void>
    press?: (key: string) => Promise<void>
  }
}

export interface BrowserLocator {
  first: () => BrowserLocator
  nth?: (index: number) => BrowserLocator
  count: () => Promise<number>
  fill: (value: string, options?: Record<string, unknown>) => Promise<void>
  click: (options?: Record<string, unknown>) => Promise<void>
  innerText: () => Promise<string>
  inputValue?: () => Promise<string>
  filter?: (options: { hasText?: RegExp | string }) => BrowserLocator
  isEnabled?: () => Promise<boolean>
  isVisible?: () => Promise<boolean>
  pressSequentially?: (text: string, options?: { delay?: number }) => Promise<void>
  scrollIntoViewIfNeeded?: () => Promise<void>
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
  /** Switch active page to the newest tab (Availity often opens apps in a new tab). */
  adoptNewestPage?: () => Promise<BrowserPage | null>
  /** Find a page/frame that contains the selector and make that page active. */
  focusPageWithSelector?: (selector: string, timeoutMs?: number) => Promise<boolean>
  /** Locate an element across all open tabs and frames (Availity apps are often iframe-hosted). */
  findLocator?: (selector: string, timeoutMs?: number) => Promise<BrowserLocator | null>
  /**
   * Collect matching locators across all open tabs/frames (for typeahead option lists
   * that live inside Availity's eligibility iframe, not the parent shell).
   */
  locateAllAcrossFrames?: (
    selector: string,
    opts?: { limit?: number }
  ) => Promise<BrowserLocator[]>
  /** Concatenate visible text from every frame (parent shell text alone is usually useless). */
  collectTextAcrossFrames?: () => Promise<string>
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
  /** Optional Stagehand LLM assist (hybrid Availity path). */
  llmAssist?: import('./stagehand-session').StagehandAssistHandle | null
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
