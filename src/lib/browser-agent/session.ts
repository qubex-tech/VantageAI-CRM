import type { Browser, BrowserContext, Page } from 'playwright-core'
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
      viewport: { width: 1440, height: 900 },
    },
    userMetadata: {
      practiceId: params?.practiceId || '',
      playbookId: params?.playbookId || '',
    },
  })

  const browser: Browser = await chromium.connectOverCDP(session.connectUrl)
  const context: BrowserContext = browser.contexts()[0] || (await browser.newContext())
  let activePage: Page = context.pages()[0] || (await context.newPage())

  const asBrowserPage = (p: Page) => p as unknown as BrowserPage

  const findLocatorAcross = async (selector: string, timeoutMs = 5_000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      for (const p of context.pages()) {
        try {
          for (const frame of p.frames()) {
            try {
              const loc = frame.locator(selector).first()
              if ((await loc.count()) > 0) {
                activePage = p
                await activePage.bringToFront().catch(() => undefined)
                return loc as unknown as import('./types').BrowserLocator
              }
            } catch {
              // cross-origin / detached frame
            }
          }
        } catch {
          // page may be closed
        }
      }
      await new Promise((r) => setTimeout(r, 400))
    }
    return null
  }

  const handle: BrowserSessionHandle = {
    sessionId: session.id,
    get page() {
      return asBrowserPage(activePage)
    },
    adoptNewestPage: async () => {
      // Wait briefly for a newly opened tab (Availity menu clicks often spawn one).
      const before = context.pages().length
      const deadline = Date.now() + 2_500
      while (Date.now() < deadline && context.pages().length <= before) {
        await new Promise((r) => setTimeout(r, 200))
      }
      const pages = context.pages()
      if (!pages.length) return null
      activePage = pages[pages.length - 1]
      await activePage.bringToFront().catch(() => undefined)
      await activePage.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined)
      return asBrowserPage(activePage)
    },
    focusPageWithSelector: async (selector: string, timeoutMs = 20_000) => {
      const found = await findLocatorAcross(selector, timeoutMs)
      return Boolean(found)
    },
    findLocator: async (selector: string, timeoutMs = 5_000) => findLocatorAcross(selector, timeoutMs),
    collectTextAcrossFrames: async () => {
      const chunks: string[] = []
      for (const p of context.pages()) {
        for (const frame of p.frames()) {
          try {
            const text = await frame.locator('body').innerText({ timeout: 3_000 })
            if (text?.trim()) chunks.push(text.trim())
          } catch {
            // cross-origin / detached
          }
        }
      }
      return chunks.join('\n---FRAME---\n')
    },
    screenshotDataUrl: async () => {
      const buf = await activePage.screenshot({ type: 'png', fullPage: false })
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

  return handle
}
