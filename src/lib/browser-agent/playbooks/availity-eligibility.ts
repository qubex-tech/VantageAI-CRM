import type { ParsedEligibilitySummary } from '@/lib/availity'
import { generateTotpFresh } from '../totp'
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

    // Step 2: enter TOTP (retry once if Availity rejects a near-expiry / reused code)
    const mfaInput = page
      .locator(
        'input[name="otp"], input[name="code"], input[name="oneTimeCode"], input[autocomplete="one-time-code"], input[placeholder*="code" i], input[aria-label*="Authenticator" i], input[aria-label*="code" i], input[id*="code" i]'
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

      for (let attempt = 1; attempt <= 2; attempt++) {
        const code = await generateTotpFresh(credential.totpSecret, { minRemainingSeconds: 5 })
        ctx.log('Submitting Availity TOTP code', { attempt })
        await typeInto(page, mfaInput, code)
        const mfaSubmit = page
          .locator(
            'button[type="submit"], button:has-text("Verify"), button:has-text("Continue"), button:has-text("Submit")'
          )
          .first()
        await mfaSubmit.click({ timeout: 15_000 })
        await page.waitForTimeout(3500)
        await page.waitForLoadState('domcontentloaded', { timeout: 45_000 }).catch(() => undefined)

        const after = ((await page.locator('body').innerText().catch(() => '')) || '').toLowerCase()
        if (looksLikeLoggedIn(after, page.url())) return null
        if (!/enter a valid code|invalid code|code is incorrect|authentication failed/.test(after)) {
          // Left the error state (navigation may still be settling)
          return null
        }
        ctx.log('Availity rejected TOTP code; retrying with next window', { attempt })
        // Wait for the next TOTP step before regenerating
        await page.waitForTimeout(6000)
      }
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

async function clickFirstMatch(
  page: NonNullable<PlaybookContext['session']>['page'],
  candidates: BrowserLocator[]
): Promise<boolean> {
  for (const el of candidates) {
    if ((await el.count()) > 0) {
      await el.click({ timeout: 10_000 }).catch(() => undefined)
      return true
    }
  }
  return false
}

const MEMBER_FIELD_SELECTOR =
  'input[name="memberId"], input[id*="member" i], input[placeholder*="Member" i], input[aria-label*="Member" i], input[placeholder*="Patient ID" i], input[aria-label*="Patient ID" i], input[name*="patientId" i]'

async function hasMemberField(ctx: PlaybookContext): Promise<boolean> {
  if (!ctx.session) return false
  if (await ctx.session.findLocator?.(MEMBER_FIELD_SELECTOR, 2_000)) return true
  return (await ctx.session.page.locator(MEMBER_FIELD_SELECTOR).count()) > 0
}

async function navigateToEligibilityForm(
  ctx: PlaybookContext
): Promise<{ ok: true } | PlaybookResult> {
  if (!ctx.session) return { ok: false, errorMessage: 'No browser session' }

  const pageNow = () => ctx.session!.page
  await pageNow().waitForTimeout(2000)

  // Preferred path: Patient Registration → Eligibility and Benefits Inquiry
  const openedPatientReg = await clickFirstMatch(pageNow(), [
    pageNow().getByRole('button', { name: /patient registration/i }).first(),
    pageNow().getByRole('link', { name: /patient registration/i }).first(),
    pageNow().locator('text=Patient Registration').first(),
    pageNow().locator('[aria-label*="Patient Registration" i]').first(),
  ])
  if (openedPatientReg) {
    ctx.log('Opened Patient Registration menu')
    await pageNow().waitForTimeout(1000)
    const openedEligibility = await clickFirstMatch(pageNow(), [
      pageNow().getByRole('menuitem', { name: /eligibility and benefits/i }).first(),
      pageNow().getByRole('link', { name: /eligibility and benefits/i }).first(),
      pageNow().locator('text=Eligibility and Benefits Inquiry').first(),
      pageNow().locator('text=Eligibility and Benefits').first(),
      pageNow().locator('a:has-text("Eligibility")').first(),
    ])
    if (openedEligibility) {
      ctx.log('Opened Eligibility and Benefits Inquiry')
      await pageNow().waitForTimeout(2500)
      // Availity often opens the tool in a new tab
      await ctx.session.adoptNewestPage?.()
      const focused = await ctx.session.focusPageWithSelector?.(MEMBER_FIELD_SELECTOR, 20_000)
      ctx.log('Post-menu eligibility focus', {
        focused,
        url: pageNow().url(),
        tabsAdopted: Boolean(ctx.session.adoptNewestPage),
      })
      await pageNow().waitForLoadState('domcontentloaded', { timeout: 45_000 }).catch(() => undefined)
    }
  }

  if (!(await hasMemberField(ctx))) {
    const urls = [
      process.env.AVAILITY_ELIGIBILITY_URL,
      'https://essentials.availity.com/static/web/webui/#/eligibility',
      'https://essentials.availity.com/static/web/webui/index.html#/eligibility',
    ].filter(Boolean) as string[]

    for (const url of urls) {
      ctx.log('Trying eligibility URL', { url })
      await pageNow().goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => undefined)
      await pageNow().waitForTimeout(2500)
      await ctx.session.adoptNewestPage?.()
      if (await hasMemberField(ctx)) break
    }
  }

  if (!(await hasMemberField(ctx))) {
    await clickFirstMatch(pageNow(), [
      pageNow().getByRole('link', { name: /eligibility/i }).first(),
      pageNow().locator('a:has-text("Eligibility")').first(),
      pageNow().locator('text=/Eligibility and Benefits/i').first(),
    ])
    await pageNow().waitForTimeout(2500)
    await ctx.session.adoptNewestPage?.()
    await ctx.session.focusPageWithSelector?.(MEMBER_FIELD_SELECTOR, 15_000)
  }

  if (!(await hasMemberField(ctx))) {
    const bodyText = (await pageNow().locator('body').innerText().catch(() => '')) || ''
    return {
      ok: false,
      errorMessage:
        'Could not open Availity Eligibility and Benefits form (check user role: Eligibility & Benefits)',
      escalateToVoice: true,
      output: { pageSnippet: bodyText.slice(0, 2000), url: pageNow().url() },
    }
  }

  return { ok: true }
}

async function submitEligibilityInquiry(ctx: PlaybookContext): Promise<PlaybookResult> {
  if (!ctx.session) {
    return { ok: false, errorMessage: 'No browser session' }
  }
  const artifacts: string[] = []
  const page = () => ctx.session!.page

  const nav = await navigateToEligibilityForm(ctx)
  if (!('ok' in nav && nav.ok === true)) return nav as PlaybookResult

  await page().waitForTimeout(1500)

  const memberId = asString(ctx.input.memberId)
  const payerName = asString(ctx.input.payerName)
  const firstName = asString(ctx.input.patientFirstName)
  const lastName = asString(ctx.input.patientLastName)
  const dob = asString(ctx.input.patientDob)
  const npi = asString(ctx.input.providerNpi)

  const fillFirst = async (selectors: string[], value: string) => {
    if (!value) return false
    const p = page()
    for (const sel of selectors) {
      const across = await ctx.session!.findLocator?.(sel, 2_500)
      if (across) {
        await typeInto(p, across, value)
        return true
      }
      const el = p.locator(sel).first()
      if ((await el.count()) > 0) {
        await typeInto(p, el, value)
        return true
      }
    }
    if (p.getByLabel) {
      for (const label of selectors.filter((s) => s.includes('placeholder'))) {
        const guess = label.match(/placeholder\*="([^"]+)/i)?.[1]
        if (!guess) continue
        const byLabel = p.getByLabel(new RegExp(guess.replace('*', ''), 'i')).first()
        if ((await byLabel.count()) > 0) {
          await typeInto(p, byLabel, value)
          return true
        }
      }
    }
    return false
  }

  const filledMember = await fillFirst(
    [
      'input[name="memberId"]',
      'input[name*="patientId" i]',
      'input[id*="member" i]',
      'input[id*="patientId" i]',
      'input[placeholder*="Member" i]',
      'input[placeholder*="Patient ID" i]',
      'input[aria-label*="Patient ID" i]',
    ],
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
  // DOB often MM/DD/YYYY in Availity UI
  const dobUi = dob ? (() => {
    const [y, m, d] = dob.split('-')
    return m && d && y ? `${m}/${d}/${y}` : dob
  })() : ''
  await fillFirst(
    [
      'input[name="patientBirthDate"]',
      'input[name="dob"]',
      'input[type="date"]',
      'input[id*="dob" i]',
      'input[id*="birth" i]',
      'input[placeholder*="Birth" i]',
      'input[placeholder*="MM/DD" i]',
    ],
    dobUi
  )
  await fillFirst(
    ['input[name="providerNpi"]', 'input[id*="npi" i]', 'input[placeholder*="NPI" i]'],
    npi
  )

  if (payerName) {
    const payerFilled = await fillFirst(
      [
        'input[name="payer"]',
        'input[id*="payer" i]',
        'input[placeholder*="Payer" i]',
        'input[aria-label*="Payer" i]',
      ],
      payerName
    )
    if (payerFilled) {
      await page().waitForTimeout(1000)
      await clickFirstMatch(page(), [
        page().getByRole('option', { name: new RegExp(payerName.slice(0, 12), 'i') }).first(),
        page().locator('[role="option"]').first(),
        page().locator('.dropdown-item, li[role="option"], .av-select__option').first(),
      ])
    }
  }

  ctx.log('Filled eligibility form fields', {
    filledMember,
    payerName,
    memberId: Boolean(memberId),
    dob: Boolean(dobUi),
    npi: Boolean(npi),
  })

  // Availity keeps Submit disabled while the eligibility iframe finishes loading / validating.
  const submitAnySelector =
    'button:has-text("Submit"), button:has-text("Check Eligibility"), button:has-text("Request Eligibility"), button[type="submit"]'

  const submitBtn = await ctx.session.findLocator?.(submitAnySelector, 20_000)
  if (submitBtn) {
    await submitBtn.scrollIntoViewIfNeeded?.().catch(() => undefined)
  }

  let submitEnabled = false
  if (submitBtn) {
    const enableDeadline = Date.now() + 60_000
    while (Date.now() < enableDeadline) {
      const enabled = submitBtn.isEnabled ? await submitBtn.isEnabled().catch(() => false) : true
      if (enabled) {
        submitEnabled = true
        break
      }
      await page().waitForTimeout(1000)
    }
  }

  if (!submitBtn || !submitEnabled) {
    const bodyText =
      (await ctx.session.collectTextAcrossFrames?.()) ||
      (await page().locator('body').innerText().catch(() => '')) ||
      ''
    if (ctx.session.screenshotDataUrl) {
      artifacts.push(await ctx.session.screenshotDataUrl())
    }
    return {
      ok: false,
      errorMessage: 'Availity eligibility Submit stayed disabled (form incomplete or still loading)',
      escalateToVoice: true,
      artifactUrls: artifacts,
      output: { pageSnippet: bodyText.slice(0, 2500), url: page().url(), filledMember },
    }
  }

  await submitBtn.click({ timeout: 15_000 })
  ctx.log('Clicked Availity eligibility Submit')

  // Wait for results inside the eligibility iframe (parent shell text is just the nav chrome).
  const resultDeadline = Date.now() + 90_000
  let bodyText = ''
  let eligibilityStatus: ParsedEligibilitySummary['eligibilityStatus'] = 'unknown'
  while (Date.now() < resultDeadline) {
    await page().waitForTimeout(2000)
    bodyText =
      (await ctx.session.collectTextAcrossFrames?.()) ||
      (await page().locator('body').innerText().catch(() => '')) ||
      ''
    const lower = bodyText.toLowerCase()

    if (looksLikeLoginPage(bodyText, page().url())) {
      if (ctx.session.screenshotDataUrl) {
        artifacts.push(await ctx.session.screenshotDataUrl())
      }
      return {
        ok: false,
        errorMessage: 'Session lost — still on Availity Sign In while submitting eligibility',
        escalateToVoice: true,
        artifactUrls: artifacts,
        output: { pageSnippet: bodyText.slice(0, 2500), url: page().url() },
      }
    }

    // Prefer explicit result signals — the inquiry form itself contains the word "Benefits".
    if (
      /not eligible|inactive|terminated|coverage.*(ended|terminated)|patient is not/i.test(lower)
    ) {
      eligibilityStatus = 'inactive'
      break
    }
    if (
      /coverage status\s*[:\-]?\s*active|\bactive coverage\b|\beligible\b|patient is eligible|status\s*[:\-]?\s*active/i.test(
        lower
      )
    ) {
      eligibilityStatus = 'active'
      break
    }
    if (/unable to (process|verify|respond)|transaction error|no response from payer/i.test(lower)) {
      eligibilityStatus = 'error'
      break
    }
    // Results view often replaces the form or shows a results section
    if (
      /benefit details|plan coverage|copay|coinsurance|deductible|out of pocket/i.test(lower) &&
      !/submit another patient/i.test(lower)
    ) {
      eligibilityStatus = /inactive|terminated|not eligible/i.test(lower) ? 'inactive' : 'active'
      break
    }
  }

  if (ctx.session.screenshotDataUrl) {
    artifacts.push(await ctx.session.screenshotDataUrl())
  }

  if (eligibilityStatus === 'unknown') {
    return {
      ok: false,
      errorMessage: 'Could not parse Availity eligibility result page',
      escalateToVoice: true,
      artifactUrls: artifacts,
      output: { pageSnippet: bodyText.slice(0, 2500), url: page().url(), filledMember },
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
      pageSnippet: bodyText.slice(0, 2500),
      url: page().url(),
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
