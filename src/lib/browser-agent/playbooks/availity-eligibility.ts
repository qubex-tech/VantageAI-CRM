import type { ParsedEligibilitySummary } from '@/lib/availity'
import { applyCallRequiredFlag, formModeForAppointmentType } from '@/lib/eligibility/lsr-gates'
import { scrapeRheumPacketFromPortalText } from '@/lib/eligibility/scrape-rpa-benefits'
import { generateTotpFresh } from '../totp'
import { markBrowserCredentialLogin } from '../credentials'
import type { BrowserLocator, BrowserPlaybook, PlaybookContext, PlaybookResult } from '../types'

const AVAILITY_LOGIN_URL =
  process.env.AVAILITY_PORTAL_LOGIN_URL || 'https://essentials.availity.com/'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const PAYER_STOP_WORDS = new Set([
  'the',
  'and',
  'of',
  'for',
  'inc',
  'llc',
  'ltd',
  'corp',
  'corporation',
  'company',
  'insurance',
  'ins',
  'plan',
  'health',
  'care',
  'medical',
  'healthcare',
  'group',
  'services',
  'service',
  'associates',
])

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  return values
    .map((t) => t.trim())
    .filter((t) => {
      if (!t) return false
      const key = t.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** Significant word tokens from any payer label (practice-agnostic). */
export function payerWordTokens(payerName: string): string[] {
  return payerName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !PAYER_STOP_WORDS.has(w))
}

/**
 * Build Availity payer typeahead queries from whatever CRM payer label we have.
 * All variants are derived from the input — no practice/payer hardcoding.
 */
export function payerSearchTerms(payerName: string, payerId?: string): string[] {
  const raw = payerName.trim()
  const terms: string[] = []
  if (raw) {
    terms.push(raw)
    const collapsed = raw.replace(/\s+/g, ' ')
    if (collapsed !== raw) terms.push(collapsed)

    const words = collapsed.split(/\s+/).filter(Boolean)
    if (words.length >= 2) {
      // "Foo Health spring" → "Foo Healthspring" and "Healthspring"
      terms.push([...words.slice(0, -2), words.slice(-2).join('')].join(' ').trim())
      terms.push(words.slice(-2).join(''))
      // Primary brand / first word often works in Availity typeahead
      terms.push(words[0])
      if (words.length >= 3) {
        terms.push(words.slice(0, 2).join(' '))
      }
    }
  }

  const id = (payerId || '').trim()
  if (id) terms.push(id)

  return uniqueStrings(terms)
}

/**
 * Distinctive tokens that should appear in the selected Availity payer option.
 * Derived from the CRM payer name so any practice/payer works.
 */
export function expectedPayerTokens(payerName: string): string[] {
  const words = payerWordTokens(payerName)
  if (!words.length) {
    const fallback = payerName.trim().split(/\s+/)[0]
    return fallback && fallback.length >= 3 ? [fallback.toLowerCase()] : []
  }

  const compounds: string[] = []
  const rawWords = payerName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  for (let i = 0; i < rawWords.length - 1; i++) {
    compounds.push(`${rawWords[i]}${rawWords[i + 1]}`)
  }

  // Prefer longer compound (e.g. healthspring) then distinctive words (e.g. cigna, spring).
  const ranked = uniqueStrings([...compounds.filter((c) => c.length >= 6), ...words]).sort(
    (a, b) => b.length - a.length
  )
  return ranked.slice(0, 3)
}

/** Whether an Availity option/label matches the expected payer (dynamic token check). */
export function payerLabelMatches(label: string, payerName: string): boolean {
  const compact = label.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!compact) return false
  const tokens = expectedPayerTokens(payerName).map((t) => t.replace(/[^a-z0-9]/g, ''))
  if (!tokens.length) return false

  const strong = tokens.filter((t) => t.length >= 6)
  if (strong.some((t) => compact.includes(t))) return true

  // Require all shorter distinctive tokens (brand + key word) so we don't accept a sticky wrong payer.
  const weak = tokens.filter((t) => t.length < 6)
  if (weak.length >= 1 && weak.every((t) => compact.includes(t))) return true

  // Single-token payer names (e.g. "Aetna")
  if (tokens.length === 1 && compact.includes(tokens[0])) return true

  return false
}

/**
 * Interpret Availity Eligibility & Benefits result text.
 * Prefer explicit AAA/rejection copy over benefit heuristics — results pages often
 * still include the inquiry form ("Submit another patient", "Benefits", etc.).
 */
export function interpretAvailityEligibilityText(bodyText: string): {
  eligibilityStatus: ParsedEligibilitySummary['eligibilityStatus']
  message?: string
} {
  const text = bodyText || ''
  const lower = text.toLowerCase()

  const rejection =
    text.match(
      /Invalid\/Missing[^\n.]{0,120}|Please Correct and Resubmit|Subscriber\/Insured ID[^\n.]{0,80}|Member (?:ID )?not found[^\n.]{0,80}|Patient not found[^\n.]{0,80}|No [Ee]ligibility[^\n.]{0,80}|Unable to (?:process|verify|respond)[^\n.]{0,80}|Transaction error[^\n.]{0,80}|Payer (?:does not|not) support[^\n.]{0,80}/
    )?.[0] ||
    (/invalid\/missing|please correct and resubmit|subscriber\/insured id|member (?:id )?not found|patient not found|no eligibility (?:data|information)|unable to (?:process|verify|respond)|transaction error/i.test(
      lower
    )
      ? 'Availity rejected the eligibility inquiry'
      : null)

  if (rejection) {
    return { eligibilityStatus: 'error', message: rejection.trim() }
  }

  if (
    /not eligible|inactive|terminated|coverage.*(ended|terminated)|patient is not/i.test(lower)
  ) {
    return { eligibilityStatus: 'inactive' }
  }

  if (
    /coverage status\s*[:\-]?\s*active|\bactive coverage\b|\beligible\b|patient is eligible|status\s*[:\-]?\s*active|\bactive\b/i.test(
      lower
    ) &&
    /coverage|eligib|benefit|plan/i.test(lower)
  ) {
    return { eligibilityStatus: 'active' }
  }

  // Results view with benefit amounts (do not exclude "Submit another patient" —
  // Availity keeps that CTA on the results screen).
  if (/benefit details|plan coverage|copay|coinsurance|deductible|out of pocket/i.test(lower)) {
    return {
      eligibilityStatus: /inactive|terminated|not eligible/i.test(lower) ? 'inactive' : 'active',
    }
  }

  return { eligibilityStatus: 'unknown' }
}

function mockSummary(ctx: PlaybookContext): ParsedEligibilitySummary {
  const payerName = asString(ctx.input.payerName) || 'Mock Payer'
  const formMode = formModeForAppointmentType(asString(ctx.input.appointmentType) || undefined)
  let rheum = scrapeRheumPacketFromPortalText(
    [
      'Active Coverage',
      'Plan Type PPO',
      'In-Network',
      'Specialist Copay: $40.00',
      'Deductible: $500.00',
      'Deductible Remaining: $250.00',
      'Coinsurance: 20%',
      'Out of Pocket Max: $3000.00',
      'Out of Pocket Remaining: $2100.00',
      'Referral not required',
      'Prior authorization not required',
      'Telehealth covered',
    ].join('\n'),
    { formMode, source: 'availity_rpa' }
  )
  rheum = applyCallRequiredFlag(rheum, asString(ctx.input.appointmentType) || undefined)
  return {
    eligibilityStatus: 'active',
    planStatus: 'Active',
    payerName,
    payerId: asString(ctx.input.payerId) || undefined,
    groupNumber: asString(ctx.input.groupNumber) || undefined,
    planName: 'Mock PPO Plan',
    planType: rheum.planType,
    benefits: [
      { name: 'Office Visit', status: 'Covered', detail: 'mock' },
      { name: 'Specialist', status: 'Covered', detail: 'mock' },
    ],
    validationMessages: [],
    rawPlanCount: 1,
    rheum,
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
  // Post-login shells also live under onboarding-ui paths — rely on page copy, not account names.
  if (
    /logout|log out|sign out|my favorites|payer spaces|patient registration|claims & payments|'s account/.test(
      lower
    )
  ) {
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

async function findInputBySelectors(
  ctx: PlaybookContext,
  selectors: string[]
): Promise<BrowserLocator | null> {
  if (!ctx.session) return null
  const page = ctx.session.page
  for (const sel of selectors) {
    const across = await ctx.session.findLocator?.(sel, 2_000)
    if (across) return across
    const el = page.locator(sel).first()
    if ((await el.count()) > 0) return el
  }
  return null
}

async function selectTypeaheadOption(
  ctx: PlaybookContext,
  params: {
    fieldSelectors: string[]
    searchTerms: string[]
    matches: (label: string) => boolean
    fieldLabel: string
  }
): Promise<{ ok: boolean; selectedLabel?: string; errorMessage?: string }> {
  if (!ctx.session) return { ok: false, errorMessage: 'No browser session' }
  const page = () => ctx.session!.page

  const readSelected = async (): Promise<string> => {
    const input = await findInputBySelectors(ctx, params.fieldSelectors)
    if (!input) return ''
    const value = (await input.inputValue?.().catch(() => '')) || ''
    if (value.trim()) return value.trim()
    return ((await input.innerText?.().catch(() => '')) || '').trim()
  }

  for (const term of params.searchTerms) {
    if (!term) continue
    const input = await findInputBySelectors(ctx, params.fieldSelectors)
    if (!input) break

    await input.click({ timeout: 10_000 }).catch(() => undefined)
    await input.fill('').catch(() => undefined)
    await input.fill(term)
    await page().waitForTimeout(1200)

    const optionRegex = new RegExp(
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'),
      'i'
    )
    const optionCandidates: BrowserLocator[] = [
      page().getByRole('option', { name: optionRegex }).first(),
    ]
    const roleOptions = page().locator('[role="option"]')
    if (roleOptions.filter) {
      optionCandidates.push(roleOptions.filter({ hasText: optionRegex }).first())
    }
    const cssOptions = page().locator(
      '.dropdown-item, li[role="option"], .av-select__option, [class*="option"]'
    )
    if (cssOptions.filter) {
      optionCandidates.push(cssOptions.filter({ hasText: optionRegex }).first())
    }

    let clicked = false
    for (const opt of optionCandidates) {
      if ((await opt.count()) > 0) {
        const optText = ((await opt.innerText().catch(() => '')) || '').trim()
        // Never click an unrelated first hit — require dynamic match when we can read the label.
        if (optText && !params.matches(optText)) continue
        await opt.click({ timeout: 10_000 }).catch(() => undefined)
        clicked = true
        break
      }
    }

    if (!clicked) continue
    await page().waitForTimeout(800)
    const selected = await readSelected()
    if (selected && params.matches(selected)) {
      ctx.log(`Selected Availity ${params.fieldLabel}`, { term, selected })
      return { ok: true, selectedLabel: selected }
    }
    if (!selected && clicked) {
      // Some selects don't mirror the label into the input value.
      return { ok: true, selectedLabel: term }
    }
  }

  const leftover = await readSelected()
  return {
    ok: false,
    errorMessage: leftover
      ? `Availity ${params.fieldLabel} still set to "${leftover}"`
      : `Could not find Availity ${params.fieldLabel} matching search terms`,
    selectedLabel: leftover || undefined,
  }
}

/** Select payer from dynamic CRM payerName / payerId — never assumes a specific payer. */
async function selectAvailityPayer(
  ctx: PlaybookContext,
  payerName: string,
  payerId?: string
): Promise<{ ok: boolean; selectedLabel?: string; errorMessage?: string }> {
  const result = await selectTypeaheadOption(ctx, {
    fieldLabel: 'payer',
    fieldSelectors: [
      'input[name="payer"]',
      'input[id*="payer" i]',
      'input[placeholder*="Payer" i]',
      'input[aria-label*="Payer" i]',
      '[data-testid*="payer" i] input',
    ],
    searchTerms: payerSearchTerms(payerName, payerId),
    matches: (label) => payerLabelMatches(label, payerName),
  })
  if (!result.ok && payerName) {
    return {
      ...result,
      errorMessage: result.selectedLabel
        ? `Availity payer still set to "${result.selectedLabel}" (wanted "${payerName}")`
        : `Could not find Availity payer matching "${payerName}"`,
    }
  }
  return result
}

/** Select organization when the Availity user has multiple orgs (practice name from CRM). */
async function selectAvailityOrganization(
  ctx: PlaybookContext,
  organizationName: string
): Promise<{ ok: boolean; selectedLabel?: string; errorMessage?: string }> {
  if (!organizationName.trim()) return { ok: true }
  const tokens = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !PAYER_STOP_WORDS.has(w))
  const terms = uniqueStrings([
    organizationName.trim(),
    organizationName.trim().split(/\s+/).slice(0, 3).join(' '),
    tokens[0] || '',
  ])

  return selectTypeaheadOption(ctx, {
    fieldLabel: 'organization',
    fieldSelectors: [
      'input[name="organization"]',
      'input[id*="organization" i]',
      'input[placeholder*="Organization" i]',
      'input[aria-label*="Organization" i]',
      '[data-testid*="organization" i] input',
    ],
    searchTerms: terms,
    matches: (label) => {
      const compact = label.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!tokens.length) return compact.includes(organizationName.toLowerCase().replace(/[^a-z0-9]/g, ''))
      // Any distinctive org token is enough (practices vary widely).
      return tokens.some((t) => compact.includes(t.replace(/[^a-z0-9]/g, '')))
    },
  })
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
  const payerId = asString(ctx.input.payerId)
  const firstName = asString(ctx.input.patientFirstName)
  const lastName = asString(ctx.input.patientLastName)
  const dob = asString(ctx.input.patientDob)
  const npi = asString(ctx.input.providerNpi)
  const providerTaxId = asString(ctx.input.providerTaxId)
  const organizationName = asString(ctx.input.organizationName)
  const serviceType = asString(ctx.input.serviceType) || '30'

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

  // DOB often MM/DD/YYYY in Availity UI
  const dobUi = dob
    ? (() => {
        const [y, m, d] = dob.split('-')
        return m && d && y ? `${m}/${d}/${y}` : dob
      })()
    : ''

  // Clear sticky prior inquiry (Availity often leaves the last payer/org selected).
  await clickFirstMatch(page(), [
    page().getByRole('button', { name: /new request/i }).first(),
    page().locator('button:has-text("New Request")').first(),
    page().locator('a:has-text("New Request")').first(),
  ])
  await page().waitForTimeout(1000)

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
  const filledNpi = await fillFirst(
    ['input[name="providerNpi"]', 'input[id*="npi" i]', 'input[placeholder*="NPI" i]'],
    npi
  )
  const filledTaxId = await fillFirst(
    [
      'input[name="providerTaxId"]',
      'input[id*="tax" i]',
      'input[placeholder*="Tax ID" i]',
      'input[aria-label*="Tax ID" i]',
    ],
    providerTaxId
  )

  if (organizationName) {
    const orgSelected = await selectAvailityOrganization(ctx, organizationName)
    if (!orgSelected.ok) {
      ctx.log('Organization select soft-failed; continuing if Availity has a default', {
        organizationName,
        error: orgSelected.errorMessage,
      })
    }
  }

  let selectedPayerLabel = ''
  if (payerName || payerId) {
    const payerSelected = await selectAvailityPayer(ctx, payerName || payerId, payerId || undefined)
    if (!payerSelected.ok) {
      if (ctx.session.screenshotDataUrl) {
        artifacts.push(await ctx.session.screenshotDataUrl())
      }
      return {
        ok: false,
        errorMessage:
          payerSelected.errorMessage ||
          `Could not select Availity payer for "${payerName || payerId}"`,
        escalateToVoice: true,
        artifactUrls: artifacts,
        output: {
          pageSnippet: ((await ctx.session.collectTextAcrossFrames?.()) || '').slice(0, 2500),
          url: page().url(),
          filledMember,
          filledNpi,
          filledTaxId,
          payerName,
          payerId,
          organizationName,
        },
      }
    }
    selectedPayerLabel = payerSelected.selectedLabel || ''
  }

  // Benefit / service type when provided (defaults to 30 — Health Benefit Plan Coverage).
  if (serviceType && serviceType !== '30') {
    await fillFirst(
      [
        'input[name="serviceType"]',
        'input[id*="serviceType" i]',
        'input[placeholder*="Service Type" i]',
        'input[aria-label*="Benefit / Service Type" i]',
      ],
      serviceType
    )
  }

  ctx.log('Filled eligibility form fields', {
    filledMember,
    filledNpi,
    filledTaxId,
    payerName,
    payerId,
    selectedPayerLabel,
    organizationName,
    memberId: Boolean(memberId),
    patientName: [firstName, lastName].filter(Boolean).join(' '),
    dob: Boolean(dobUi),
    npi: Boolean(npi),
    serviceType,
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
  let resultMessage: string | undefined
  while (Date.now() < resultDeadline) {
    await page().waitForTimeout(2000)
    bodyText =
      (await ctx.session.collectTextAcrossFrames?.()) ||
      (await page().locator('body').innerText().catch(() => '')) ||
      ''

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

    const interpreted = interpretAvailityEligibilityText(bodyText)
    if (interpreted.eligibilityStatus !== 'unknown') {
      eligibilityStatus = interpreted.eligibilityStatus
      resultMessage = interpreted.message
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
      output: {
        pageSnippet: bodyText.slice(0, 2500),
        url: page().url(),
        filledMember,
        filledNpi,
        selectedPayerLabel,
      },
    }
  }

  if (eligibilityStatus === 'error') {
    return {
      ok: false,
      errorMessage: resultMessage || 'Availity returned an eligibility error',
      escalateToVoice: true,
      artifactUrls: artifacts,
      output: {
        summary: {
          eligibilityStatus: 'error',
          payerName: selectedPayerLabel || payerName || undefined,
          payerId: asString(ctx.input.payerId) || undefined,
          validationMessages: resultMessage ? [resultMessage] : [],
          benefits: [],
          rawPlanCount: 0,
        } satisfies ParsedEligibilitySummary,
        pageSnippet: bodyText.slice(0, 2500),
        url: page().url(),
        filledMember,
        filledNpi,
        selectedPayerLabel,
      },
    }
  }

  const formMode = formModeForAppointmentType(asString(ctx.input.appointmentType) || undefined)
  let rheum = scrapeRheumPacketFromPortalText(bodyText, { formMode, source: 'availity_rpa' })
  rheum = applyCallRequiredFlag(rheum, asString(ctx.input.appointmentType) || undefined)

  const summary: ParsedEligibilitySummary = {
    eligibilityStatus,
    payerName: selectedPayerLabel || payerName || undefined,
    payerId: asString(ctx.input.payerId) || undefined,
    groupNumber: asString(ctx.input.groupNumber) || undefined,
    planType: rheum.planType,
    benefits: [],
    validationMessages: [],
    rawPlanCount: 0,
    rheum,
  }

  return {
    ok: true,
    output: {
      summary,
      source: 'availity_rpa',
      pageSnippet: bodyText.slice(0, 2500),
      url: page().url(),
      selectedPayerLabel,
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
