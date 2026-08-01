import Browserbase from '@browserbasehq/sdk'
import { chromium, type Browser, type Page } from 'playwright-core'
import type { BrowserSessionHandle } from './types'

export function isBrowserbaseConfigured(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY?.trim() && process.env.BROWSERBASE_PROJECT_ID?.trim())
}

export async function createBrowserSession(params?: {
  practiceId?: string
  playbookId?: string
}): Promise<BrowserSessionHandle> {
  if (!isBrowserbaseConfigured()) {
    throw new Error(
      'Browserbase is not configured. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID, or use mock mode.'
    )
  }

  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! })
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      // Keep sessions short; playbooks should finish within minutes
      viewport: { width: 1280, height: 800 },
    },
    userMetadata: {
      practiceId: params?.practiceId || '',
      playbookId: params?.playbookId || '',
    },
  })

  const browser: Browser = await chromium.connectOverCDP(session.connectUrl)
  const context = browser.contexts()[0] || (await browser.newContext())
  const page: Page = context.pages()[0] || (await context.newPage())

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
