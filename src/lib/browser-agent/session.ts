import type { BrowserPage, BrowserSessionHandle } from './types'

export function isBrowserbaseConfigured(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY?.trim() && process.env.BROWSERBASE_PROJECT_ID?.trim())
}

/**
 * Opens a Browserbase session and connects Playwright over CDP.
 * Playwright / Browserbase are loaded dynamically so Next.js webpack does not
 * try to bundle their optional native deps (chromium-bidi, kerberos, etc.).
 */
export async function createBrowserSession(params?: {
  practiceId?: string
  playbookId?: string
}): Promise<BrowserSessionHandle> {
  if (!isBrowserbaseConfigured()) {
    throw new Error(
      'Browserbase is not configured. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID, or use mock mode.'
    )
  }

  const [{ default: Browserbase }, { chromium }] = await Promise.all([
    import('@browserbasehq/sdk'),
    import('playwright-core'),
  ])

  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! })
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      viewport: { width: 1280, height: 800 },
    },
    userMetadata: {
      practiceId: params?.practiceId || '',
      playbookId: params?.playbookId || '',
    },
  })

  const browser = await chromium.connectOverCDP(session.connectUrl)
  const context = browser.contexts()[0] || (await browser.newContext())
  const page = (context.pages()[0] || (await context.newPage())) as unknown as BrowserPage

  return {
    sessionId: session.id,
    page,
    screenshotDataUrl: async () => {
      const buf = await page.screenshot({ type: 'png', fullPage: false })
      return `data:image/png;base64,${buf.toString('base64')}`
    },
    close: async () => {
      try {
        await browser.close()
      } catch {
        // ignore
      }
      try {
        await bb.sessions.update(session.id, { status: 'REQUEST_RELEASE' })
      } catch {
        // ignore — session may already be released
      }
    },
  }
}
