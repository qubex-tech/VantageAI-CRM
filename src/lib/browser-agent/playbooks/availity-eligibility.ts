import type { ParsedEligibilitySummary } from '@/lib/availity'
import { generateTotp } from '../totp'
import { markBrowserCredentialLogin } from '../credentials'
import type { BrowserLocator, BrowserPlaybook, PlaybookContext, PlaybookResult } from '../types'

const AVAILITY_LOGIN_URL =
  process.env.AVAILITY_PORTAL_LOGIN_URL || 'https://essentials.availity.com/'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function mockSummary(ctx: PlaybookContext): ParsedEligibilitySummary {
  const payerName = asString(ctx.input.payerName) || 'Mock Payer'
  return {
    eligibilityStatus: 'active',
    planStatus: 'Active',
    payerName,
    payerId: asString(ctx.input.payerId) || undefined,
    groupNumber: asString(ctx.input.groupNumber) || undefined,
    planName: 'Mock PPO Plan',
    benefits: [
      { name: 'Office Visit', status: 'Covered', detail: 'mock' },
      { name: 'Specialist', status: 'Covered', detail: 'mock' },
    ],
    validationMessages: [],
    rawPlanCount: 1,
  }
}

async function findVisibleInput(
  page: PlaybookContext['session'] extends null ? never : NonNullable<PlaybookContext['session']>['page'],
  selectors: string[]
): Promise<BrowserLocator | null> {
  for (const sel of selectors) {
    const el = page.locator(sel).first()
    if ((await el.count()) > 0) return el
  }
  return null
}

/** Click, clear, then fill once — never append a second keyboard pass. */
async function typeInto(
  _page: NonNullable<PlaybookContext['session']>['page'],
  el: BrowserLocator,
  value: string
) {
  await el.click({ timeout: 10_000 }).catch(() => undefined)
  await el.fill('')
  await el.fill(value)
}

function looksLikeLoginPage(text: string, url: string): boolean {
  const lower = text.toLowerCase()
  const u = url.toLowerCase()
  // Post-login shells also live under onboarding-ui paths — rely on page copy, not that path alone.
  if (/logout|log out|sign out|saqib's account|my favorites|payer spaces|patient registration/.test(lower)) {
    return false
  }
  return (
    (/sign in|forgot your password|forgot your user id|enter a valid user id|enter a valid password|create a free account|user id \/ password combination was not recognized/.test(
      lower
    ) &&
      !/logout|log out/.test(lower)) ||
    /availity-fr-ui\/#\/login|\/#\/login\b/.test(u)
  )
}

function looksLikeLoggedIn(text: string, url: string): boolean {
  const lower = text.toLowerCase()
  const u = url.toLowerCase()
  if (looksLikeLoginPage(text, url)) return false
  return (
    /logout|log out|sign out|my favorites|payer spaces|patient registration|claims & payments|availity essentials navigation/.test(
      lower
    ) ||
    (/onboarding-ui-apps\/navigation/.test(u) && !/login/.test(u)) ||
    (/static\/web\/webui/.test(u) && !/login/.test(u))
  )
}

async function completeAvailityMfa(ctx: PlaybookContext): Promise<PlaybookResult | null> {
  if (!ctx.credential || !ctx.session) return null
  const { page } = ctx.session
  const { credential } = ctx

  for (let i = 0; i < 12; i++) {
    const bodyText = ((await page.locator('body').innerText().catch(() => '')) || '').toLowerCase()

    // Step 1: method chooser — pick Authenticator app
    if (
      bodyText.includes('how would you like to authenticate') ||
      bodyText.includes('authenticate me using my authenticator app')
    ) {
      const optionCandidates = [
        page.getByRole('radio', { name: /authenticator/i }).first(),
        page.locator('label:has-text("Authenticator app")').first(),
        page.locator('text=Authenticate me using my Authenticator app').first(),
        page.locator('input[type="radio"]').first(),
      ]
      for (const opt of optionCandidates) {
        if ((await opt.count()) > 0) {
          await opt.click({ timeout: 10_000 }).catch(() => undefined)
          break
        }
      }
      const continueBtn = page
        .locator('button:has-text("Continue"), button[type="submit"]')
        .first()
      if ((await continueBtn.count()) > 0) {
        await continueBtn.click({ timeout: 10_000 })
        await page.waitForTimeout(2000)
        await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined)
      }
    }

    // Step 2: enter TOTP
    const mfaInput = page
      .locator(
        'input[name="otp"], input[name="code"], input[name="oneTimeCode"], input[autocomplete="one-time-code"], input[placeholder*="code" i], input[aria-label*="code" i], input[id*="code" i]'
      )
      .first()
    if ((await mfaInput.count()) > 0) {
      if (!credential.totpSecret) {
        await markBrowserCredentialLogin(credential.id, {
          ok: false,
          error: 'mfa_required_no_totp',
        })
        return {
          ok: false,
          errorMessage: 'Availity MFA required but no TOTP secret stored',
          escalateToVoice: true,
        }
      }
      const code = generateTotp(credential.totpSecret)
      ctx.log('Submitting Availity TOTP code')
      await typeInto(page, mfaInput, code)
      const mfaSubmit = page
        .locator(
          'button[type="submit"], button:has-text("Verify"), button:has-text("Continue"), button:has-text("Submit")'
        )
        .first()
      await mfaSubmit.click({ timeout: 15_000 })
      await page.waitForTimeout(3000)
      await page.waitForLoadState('domcontentloaded', { timeout: 45_000 }).catch(() => undefined)
      return null
    }

    // Already past MFA
    if (looksLikeLoggedIn(bodyText, page.url())) return null
    if (
      looksLikeLoginPage(bodyText, page.url()) &&
      !/2-step|authenticator|verification code|one-time/.test(bodyText)
    ) {
      return null // let caller evaluate login failure
    }

    await page.waitForTimeout(1000)
  }

  const snippet = (await page.locator('body').innerText().catch(() => '')) || ''
  if (/2-step|authenticator|how would you like to authenticate/.test(snippet.toLowerCase())) {
    await markBrowserCredentialLogin(credential.id, { ok: false, error: 'mfa_not_completed' })
    return {
      ok: false,
      errorMessage: 'Availity MFA challenge was not completed',
      escalateToVoice: true,
      output: { pageSnippet: snippet.slice(0, 2000), url: page.url() },
    }
  }
  return null
}

async function loginAvaility(ctx: PlaybookContext): Promise<PlaybookResult | null> {
  if (!ctx.credential || !ctx.session) {
    return { ok: false, errorMessage: 'Missing Availity portal credentials or browser session' }
  }

  const { page } = ctx.session
  const { credential } = ctx

  try {
    await page.goto(AVAILITY_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(2500)
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)

    // Prefer label-based selectors; Availity onboarding UI may also mount inside iframes.
    let userEl =
      (page.getByLabel
        ? page.getByLabel(/user id|username/i).first()
        : null)
    if (userEl && (await userEl.count()) === 0) userEl = null

    let passEl =
      (page.getByLabel ? page.getByLabel(/^password$/i).first() : null)
    if (passEl && (await passEl.count()) === 0) passEl = null

    if (!userEl) {
      userEl = await findVisibleInput(page, [
        'input[name="userId"]',
        'input#userId',
        'input[name="username"]',
        'input[autocomplete="username"]',
        'input[id*="user" i]',
        'input[placeholder*="User ID" i]',
        'input[placeholder*="Username" i]',
        'input[type="email"]',
      ])
    }

    if (!passEl) {
      passEl = await findVisibleInput(page, [
        'input[name="password"]',
        'input#password',
        'input[autocomplete="current-password"]',
        'input[type="password"]',
      ])
    }

    // Iframe fallback (Availity FR / onboarding shell)
    if ((!userEl || !passEl) && page.frameLocator) {
      for (const frameSel of ['iframe', 'iframe[src*="availity"]', 'iframe[src*="onb"]']) {
        const frame = page.frameLocator(frameSel)
        const frameUser = frame.locator(
          'input[name="userId"], input#userId, input[autocomplete="username"], input[placeholder*="User ID" i]'
        ).first()
        const framePass = frame.locator(
          'input[name="password"], input#password, input[type="password"]'
        ).first()
        if ((await frameUser.count()) > 0 && (await framePass.count()) > 0) {
          userEl = frameUser
          passEl = framePass
          ctx.log('Using Availity login iframe', { frameSel })
          break
        }
      }
    }

    if (!userEl) {
      return {
        ok: false,
        errorMessage: 'Availity login: username field not found (UI may have changed)',
        escalateToVoice: true,
      }
    }
    if (!passEl) {
      return {
        ok: false,
        errorMessage: 'Availity login: password field not found (UI may have changed)',
        escalateToVoice: true,
      }
    }

    await typeInto(page, userEl, credential.username)
    await typeInto(page, passEl, credential.password)
    await page.waitForTimeout(400)

    const submit = page
      .locator(
        'button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Log In")'
      )
      .first()
    await submit.click({ timeout: 15_000 })
    await page.waitForTimeout(2000)
    await page.waitForLoadState('domcontentloaded', { timeout: 45_000 }).catch(() => undefined)
    await page.waitForTimeout(2000)

    // MFA chooser → Authenticator app → TOTP code
    const mfaResult = await completeAvailityMfa(ctx)
    if (mfaResult) return mfaResult

    const bodyText = (await page.locator('body').innerText().catch(() => '')) || ''
    const url = page.url()
    const lower = bodyText.toLowerCase()

    if (
      lower.includes('captcha') ||
      lower.includes('verify you are human') ||
      (lower.includes('recaptcha') && !/2-step authentication|authenticator app/.test(lower))
    ) {
      await markBrowserCredentialLogin(credential.id, { ok: false, error: 'captcha_or_challenge' })
      return {
        ok: false,
        errorMessage: 'Availity presented a CAPTCHA/challenge wall',
        escalateToVoice: true,
        output: { pageSnippet: bodyText.slice(0, 2000), url },
      }
    }

    if (
      lower.includes('enter a valid user id') ||
      lower.includes('enter a valid password') ||
      lower.includes('combination was not recognized') ||
      lower.includes('invalid user') ||
      lower.includes('invalid password') ||
      lower.includes('authentication failed')
    ) {
      await markBrowserCredentialLogin(credential.id, { ok: false, error: 'invalid_credentials_or_empty_fields' })
      return {
        ok: false,
        errorMessage: 'Availity login rejected credentials (or fields were not filled)',
        escalateToVoice: true,
        output: { pageSnippet: bodyText.slice(0, 2000), url },
      }
    }

    if (looksLikeLoginPage(bodyText, url) && !looksLikeLoggedIn(bodyText, url)) {
      await markBrowserCredentialLogin(credential.id, { ok: false, error: 'still_on_login_page' })
      return {
        ok: false,
        errorMessage: 'Availity login did not leave the Sign In page',
        escalateToVoice: true,
        output: { pageSnippet: bodyText.slice(0, 2000), url },
      }
    }

    await markBrowserCredentialLogin(credential.id, { ok: true })
    ctx.log('Availity login succeeded', { url })
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Availity login failed'
    if (credential) {
      await markBrowserCredentialLogin(credential.id, { ok: false, error: message })
    }
    return { ok: false, errorMessage: message, escalateToVoice: true }
  }
}

async function submitEligibilityInquiry(ctx: PlaybookContext): Promise<PlaybookResult> {
  if (!ctx.session) {
    return { ok: false, errorMessage: 'No browser session' }
  }
  const { page } = ctx.session
  const artifacts: string[] = []

  const eligibilityUrl =
    process.env.AVAILITY_ELIGIBILITY_URL ||
    'https://essentials.availity.com/static/web/webui/#/eligibility'

  try {
    await page.goto(eligibilityUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  } catch {
    const link = page.getByRole('link', { name: /eligibility/i }).first()
    if ((await link.count()) > 0) {
      await link.click()
      await page.waitForLoadState('domcontentloaded', { timeout: 45_000 }).catch(() => undefined)
    }
  }

  await page.waitForTimeout(2000)

  const memberId = asString(ctx.input.memberId)
  const payerName = asString(ctx.input.payerName)
  const firstName = asString(ctx.input.patientFirstName)
  const lastName = asString(ctx.input.patientLastName)
  const dob = asString(ctx.input.patientDob)
  const npi = asString(ctx.input.providerNpi)

  const fillFirst = async (selectors: string[], value: string) => {
    if (!value) return false
    for (const sel of selectors) {
      const el = page.locator(sel).first()
      if ((await el.count()) > 0) {
        await typeInto(page, el, value)
        return true
      }
    }
    return false
  }

  await fillFirst(
    ['input[name="memberId"]', 'input[id*="member" i]', 'input[placeholder*="Member" i]'],
    memberId
  )
  await fillFirst(
    ['input[name="patientFirstName"]', 'input[id*="firstName" i]', 'input[placeholder*="First" i]'],
    firstName
  )
  await fillFirst(
    ['input[name="patientLastName"]', 'input[id*="lastName" i]', 'input[placeholder*="Last" i]'],
    lastName
  )
  await fillFirst(
    [
      'input[name="patientBirthDate"]',
      'input[type="date"]',
      'input[id*="dob" i]',
      'input[placeholder*="Birth" i]',
    ],
    dob
  )
  await fillFirst(
    ['input[name="providerNpi"]', 'input[id*="npi" i]', 'input[placeholder*="NPI" i]'],
    npi
  )

  if (payerName) {
    const payerInput = page
      .locator('input[name="payer"], input[id*="payer" i], input[placeholder*="Payer" i]')
      .first()
    if ((await payerInput.count()) > 0) {
      await typeInto(page, payerInput, payerName)
      await page.waitForTimeout(800)
      const option = page.locator('[role="option"], .dropdown-item, li').first()
      if ((await option.count()) > 0) {
        await option.click().catch(() => undefined)
      }
    }
  }

  const submit = page
    .locator('button:has-text("Submit"), button:has-text("Check Eligibility"), button[type="submit"]')
    .first()
  if ((await submit.count()) > 0) {
    await submit.click({ timeout: 15_000 })
  } else {
    return {
      ok: false,
      errorMessage: 'Availity eligibility submit button not found (UI may have changed)',
      escalateToVoice: true,
    }
  }

  await page.waitForTimeout(3000)
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined)

  if (ctx.session.screenshotDataUrl) {
    artifacts.push(await ctx.session.screenshotDataUrl())
  }

  const bodyText = (await page.locator('body').innerText().catch(() => '')) || ''
  const lower = bodyText.toLowerCase()

  if (looksLikeLoginPage(bodyText, page.url())) {
    return {
      ok: false,
      errorMessage: 'Session lost — still on Availity Sign In while submitting eligibility',
      escalateToVoice: true,
      artifactUrls: artifacts,
      output: { pageSnippet: bodyText.slice(0, 2000), url: page.url() },
    }
  }

  let eligibilityStatus: ParsedEligibilitySummary['eligibilityStatus'] = 'unknown'
  if (lower.includes('not eligible') || lower.includes('inactive') || lower.includes('terminated')) {
    eligibilityStatus = 'inactive'
  } else if (lower.includes('active') || lower.includes('eligible')) {
    eligibilityStatus = 'active'
  } else if (lower.includes('error') || lower.includes('unable to')) {
    eligibilityStatus = 'error'
  }

  if (eligibilityStatus === 'unknown' && !lower.includes('eligibility') && !lower.includes('benefit')) {
    return {
      ok: false,
      errorMessage: 'Could not parse Availity eligibility result page',
      escalateToVoice: true,
      artifactUrls: artifacts,
      output: { pageSnippet: bodyText.slice(0, 2000) },
    }
  }

  const summary: ParsedEligibilitySummary = {
    eligibilityStatus,
    payerName: payerName || undefined,
    payerId: asString(ctx.input.payerId) || undefined,
    groupNumber: asString(ctx.input.groupNumber) || undefined,
    benefits: [],
    validationMessages: [],
    rawPlanCount: 0,
  }

  return {
    ok: true,
    output: {
      summary,
      source: 'availity_rpa',
      pageSnippet: bodyText.slice(0, 2000),
    },
    artifactUrls: artifacts,
  }
}

export const availityEligibilityPlaybook: BrowserPlaybook = {
  id: 'availity.eligibility',
  site: 'availity',
  description: 'Log into Availity Essentials and run Eligibility & Benefits Inquiry',
  requiresBrowser: true,
  async run(ctx) {
    if (ctx.useMock) {
      const summary = mockSummary(ctx)
      ctx.log('Availity eligibility mock result', { eligibilityStatus: summary.eligibilityStatus })
      return {
        ok: true,
        output: {
          summary,
          source: 'availity_rpa_mock',
          mock: true,
        },
      }
    }

    const loginError = await loginAvaility(ctx)
    if (loginError) return loginError
    return submitEligibilityInquiry(ctx)
  },
}
