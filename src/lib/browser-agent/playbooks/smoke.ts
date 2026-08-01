import type { BrowserPlaybook } from '../types'

/** Opens a page and captures a screenshot — validates Browserbase wiring. */
export const smokePlaybook: BrowserPlaybook = {
  id: 'browser.smoke',
  site: 'smoke',
  description: 'Navigate to example.com and capture a screenshot',
  requiresBrowser: true,
  async run(ctx) {
    if (ctx.useMock || !ctx.session) {
      return {
        ok: true,
        output: {
          mock: true,
          title: 'Example Domain',
          url: 'https://example.com',
        },
      }
    }

    const { page } = ctx.session
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const title = await page.title()
    const url = page.url()
    const artifacts: string[] = []
    if (ctx.session.screenshotDataUrl) {
      artifacts.push(await ctx.session.screenshotDataUrl())
    }
    ctx.log('smoke complete', { title, url })
    return {
      ok: true,
      output: { title, url },
      artifactUrls: artifacts,
    }
  },
}
