import type { ParsedEligibilitySummary } from '@/lib/availity'
import { applyCallRequiredFlag, formModeForAppointmentType } from '@/lib/eligibility/lsr-gates'
import { scrapeRheumPacketFromPortalText } from '@/lib/eligibility/scrape-rpa-benefits'
import { generateTotpFresh } from '../totp'
import { markBrowserCredentialLogin } from '../credentials'
import {
  practicePlaybookConfigFromInput,
  type AvailityEligibilityPlaybookConfig,
} from '../practice-playbook'
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
  'all',
  'states',
])

/** US state / territory tokens used to keep geo-specific payers from matching generic brands. */
const GEO_REGION_TOKENS = new Set([
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'hampshire',
  'jersey',
  'mexico',
  'york',
  'carolina',
  'dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'wisconsin',
  'wyoming',
  'district',
  'columbia',
])

/** Trailing CRM noise that rarely appears in Availity dropdown labels. */
const PAYER_TRAILING_NOISE = /\bof\s+all\s+states\b/gi

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

export function compactPayerText(value: string): string {
  return normalizePayerText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Distinguish uncommitted typeahead leftover ("united" still in the box) from a
 * real commit where the Availity label equals the typed brand (e.g. CIGNA).
 * Typed leftover only counts while the dropdown is still open.
 */
export function isUncommittedTypeaheadValue(params: {
  selected: string
  typedTerm: string
  dropdownStillOpen: boolean
}): boolean {
  const selectedCompact = compactPayerText(params.selected)
  const termCompact = compactPayerText(params.typedTerm)
  if (!selectedCompact || !termCompact) return false
  if (selectedCompact !== termCompact) return false
  return params.dropdownStillOpen
}

/**
 * Normalize payer labels for matching/search.
 * Collapses spacing and "health care" → "healthcare" (Availity's common spelling).
 */
export function normalizePayerText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bhealth\s+care\b/gi, 'Healthcare')
    .replace(PAYER_TRAILING_NOISE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Geo/region tokens present in a CRM payer name (e.g. texas). */
export function payerGeoTokens(payerName: string): string[] {
  return normalizePayerText(payerName)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => GEO_REGION_TOKENS.has(w))
}

/** Significant word tokens from any payer label (practice-agnostic). */
export function payerWordTokens(payerName: string): string[] {
  return normalizePayerText(payerName)
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
  const normalized = normalizePayerText(raw)
  const terms: string[] = []
  const id = (payerId || '').trim()
  // Prefer Availity payer id when available.
  if (id) terms.push(id)

  // Recording-validated order: short brand query first (e.g. "united"), then
  // normalized full label, then longer CRM variants. Availity typeahead ranks
  // best on short brand tokens; long CRM names often leave uncommitted leftover text.
  for (const base of uniqueStrings([normalized, raw])) {
    const words = base.split(/\s+/).filter(Boolean)
    if (words[0]) terms.push(words[0])
    if (words.length >= 2) terms.push(words.slice(0, 2).join(' '))
  }
  if (normalized) terms.push(normalized)
  if (raw && raw.toLowerCase() !== normalized.toLowerCase()) terms.push(raw)

  for (const base of uniqueStrings([normalized, raw])) {
    const words = base.split(/\s+/).filter(Boolean)
    if (words.length >= 2) {
      // "Foo Health spring" → "Foo Healthspring" and "Healthspring"
      terms.push([...words.slice(0, -2), words.slice(-2).join('')].join(' ').trim())
      terms.push(words.slice(-2).join(''))
      if (words.length >= 3) {
        terms.push(words.slice(0, 3).join(' '))
      }
    }
  }

  return uniqueStrings(terms)
}

/**
 * Distinctive tokens that should appear in the selected Availity payer option.
 * Derived from the CRM payer name so any practice/payer works.
 */
export function expectedPayerTokens(payerName: string): string[] {
  const normalized = normalizePayerText(payerName)
  const words = payerWordTokens(normalized)
  if (!words.length) {
    const fallback = normalized.split(/\s+/)[0]
    return fallback && fallback.length >= 3 ? [fallback.toLowerCase()] : []
  }

  const compounds: string[] = []
  const rawWords = normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  for (let i = 0; i < rawWords.length - 1; i++) {
    compounds.push(`${rawWords[i]}${rawWords[i + 1]}`)
  }

  // Prefer longer compound (e.g. unitedhealthcare / healthspring) then distinctive words.
  const ranked = uniqueStrings([...compounds.filter((c) => c.length >= 6), ...words]).sort(
    (a, b) => b.length - a.length
  )
  return ranked.slice(0, 4)
}

/** Whether an Availity option/label matches the expected payer (dynamic token check). */
export function payerLabelMatches(label: string, payerName: string): boolean {
  const compact = compactPayerText(label)
  if (!compact) return false

  const geo = payerGeoTokens(payerName)
  if (geo.length > 0 && !geo.every((g) => compact.includes(g))) {
    return false
  }

  const compactName = compactPayerText(payerName)
  // Brand-level Availity labels (Frequently Used: "CIGNA") for CRM "Cigna" / "Cigna PPO".
  // Require a meaningful brand length so tiny prefixes don't match unrelated payers.
  if (
    compact.length >= 4 &&
    (compactName === compact ||
      compactName.startsWith(compact) ||
      // Allow Availity "CIGNA" ↔ CRM first token only when label is exactly that brand.
      payerWordTokens(payerName)[0] === compact)
  ) {
    // Reject Medicare/Medicaid product lines unless CRM also says so.
    const crmHasMedicare = /medicare|advantage|medicaid|dual/.test(compactName)
    const labelHasMedicare = /medicare|advantage|medicaid|dual/.test(compact)
    if (labelHasMedicare && !crmHasMedicare) {
      // fall through to token checks (usually fail for HEALTHSPRING vs commercial Cigna)
    } else {
      return true
    }
  }

  const tokens = expectedPayerTokens(payerName).map((t) => t.replace(/[^a-z0-9]/g, ''))
  if (!tokens.length) return false

  const strong = tokens.filter((t) => t.length >= 6)
  if (strong.some((t) => compact.includes(t))) return true

  // Require all shorter distinctive tokens (brand + key word) so we don't accept a sticky wrong payer.
  const weak = tokens.filter((t) => t.length < 6 && !GEO_REGION_TOKENS.has(t))
  if (weak.length >= 1 && weak.every((t) => compact.includes(t))) return true

  // Single-token payer names (e.g. "Aetna")
  if (tokens.length === 1 && compact.includes(tokens[0])) return true

  return false
}

/**
 * Score an Availity dropdown label against the CRM payer name.
 * Higher is better; null means not a match. Prefers exact/normalized equality,
 * then shorter brand labels over longer plan variants.
 */
export function scorePayerLabel(label: string, payerName: string): number | null {
  if (!payerLabelMatches(label, payerName)) return null

  const compactLabel = compactPayerText(label)
  const compactName = compactPayerText(payerName)
  const normLabel = normalizePayerText(label).toLowerCase()
  const normName = normalizePayerText(payerName).toLowerCase()

  let score = 1000
  if (compactLabel === compactName || normLabel === normName) {
    score += 500
  } else if (compactName.startsWith(compactLabel) || compactLabel === compactName.slice(0, compactLabel.length)) {
    // Brand-level Availity label contained in CRM name (UNITED HEALTHCARE ⊂ United Healthcare Of …)
    score += 400 - Math.min(compactLabel.length, 200)
  } else if (compactLabel.includes(compactName) || compactName.includes(compactLabel)) {
    score += 250 - Math.min(compactLabel.length, 200)
  } else {
    score += 100 - Math.min(compactLabel.length, 80)
  }

  // Prefer the shortest strong match so base "UNITED HEALTHCARE" beats plan variants.
  score += Math.max(0, 80 - compactLabel.length)

  // Don't let Medicare Advantage / Medicaid product lines win for commercial CRM labels.
  const crmHasMedicare = /medicare|advantage|medicaid|dual/.test(normName)
  const labelHasMedicare = /medicare|advantage|medicaid|dual/.test(normLabel)
  if (labelHasMedicare && !crmHasMedicare) score -= 600

  return score
}

/** Pick the best Availity payer label from a list of candidates. */
export function pickBestPayerLabel(labels: string[], payerName: string): string | null {
  let best: { label: string; score: number } | null = null
  for (const label of labels) {
    const trimmed = label.trim()
    if (!trimmed) continue
    const score = scorePayerLabel(trimmed, payerName)
    if (score == null) continue
    if (!best || score > best.score) best = { label: trimmed, score }
  }
  return best?.label ?? null
}

/**
 * Interpret Availity Eligibility & Benefits result text.
 * Prefer explicit AAA/rejection copy over benefit heuristics — results pages often
 * still include the inquiry form ("Submit another patient", "Benefits", etc.) and
 * prior patients' "Active Coverage" in the left history rail.
 */
export function interpretAvailityEligibilityText(
  bodyText: string,
  opts?: { memberId?: string; patientLastName?: string }
): {
  eligibilityStatus: ParsedEligibilitySummary['eligibilityStatus']
  message?: string
} {
  const text = bodyText || ''
  const lower = text.toLowerCase()

  const rejection =
    text.match(
      /Invalid\/Missing[^\n.]{0,160}|Please Correct and Resubmit|Subscriber\/Insured ID[^\n.]{0,80}|Member (?:ID )?not found[^\n.]{0,80}|Patient not found[^\n.]{0,80}|No [Ee]ligibility[^\n.]{0,80}|Unable to (?:process|verify|respond)[^\n.]{0,80}|Transaction error[^\n.]{0,80}|Payer (?:does not|not) support[^\n.]{0,80}/
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

  const memberId = (opts?.memberId || '').trim()
  const lastName = (opts?.patientLastName || '').trim()
  if (memberId) {
    const memberRe = memberId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const scopedActive = new RegExp(
      `(?:${memberRe}[\\s\\S]{0,1200}(?:member status\\s*)?active coverage)|(?:(?:member status\\s*)?active coverage[\\s\\S]{0,1200}${memberRe})`,
      'i'
    )
    if (scopedActive.test(text)) {
      return { eligibilityStatus: 'active' }
    }
    // History rail often shows another patient's Active Coverage — keep waiting.
    if (/\bactive coverage\b/i.test(text)) {
      return { eligibilityStatus: 'unknown' }
    }
  } else if (lastName) {
    const nameRe = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const scopedActive = new RegExp(
      `${nameRe}[\\s\\S]{0,1200}(?:member status\\s*)?active coverage`,
      'i'
    )
    if (scopedActive.test(text)) {
      return { eligibilityStatus: 'active' }
    }
  }

  if (
    /coverage status\s*[:\-]?\s*active|\bmember status\s*active coverage\b|\bactive coverage\b/i.test(
      lower
    ) &&
    /coverage|eligib|benefit|plan/i.test(lower)
  ) {
    return { eligibilityStatus: 'active' }
  }

  // Results view with benefit amounts (do not exclude "Submit another patient" —
  // Availity keeps that CTA on the results screen).
  if (/benefit details|plan coverage|copay|coinsurance|deductible|out of pocket/i.test(lower)) {
    // Without a member-scoped Active Coverage hit, amounts alone are not enough
    // (sidebar history / prior inquiries can include dollar rows).
    if (memberId) return { eligibilityStatus: 'unknown' }
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

async function collectTypeaheadCandidates(
  ctx: PlaybookContext
): Promise<Array<{ label: string; locator: BrowserLocator }>> {
  const found: Array<{ label: string; locator: BrowserLocator }> = []
  const seen = new Set<string>()
  const page = ctx.session?.page
  if (!page) return found

  const pushUnique = (label: string, locator: BrowserLocator) => {
    const trimmed = label
      .replace(/\s+/g, ' ')
      .replace(/\bEssentials Plus\b/gi, '')
      .trim()
    if (!trimmed || trimmed.length < 2 || trimmed.length > 120) return
    // Skip chrome / form labels that show up near the payer widget.
    if (
      /^(other payers|frequently used payers|payer|organization|provider|submit|clear section|need help)/i.test(
        trimmed
      )
    ) {
      return
    }
    const key = compactPayerText(trimmed)
    if (!key || seen.has(key)) return
    seen.add(key)
    found.push({ label: trimmed, locator })
  }

  const optionSelectors = [
    '[role="option"]',
    '.dropdown-item',
    'li[role="option"]',
    '.av-select__option',
    '[class*="Menu"] [class*="option"]',
    '[class*="option"]',
  ]

  // Availity Eligibility runs inside an iframe — query every frame, not just the shell.
  for (const sel of optionSelectors) {
    const across = (await ctx.session?.locateAllAcrossFrames?.(sel, { limit: 40 })) || []
    if (across.length) {
      for (const loc of across) {
        const text = ((await loc.innerText().catch(() => '')) || '').trim()
        if (text) pushUnique(text, loc)
      }
      continue
    }
    const list = page.locator(sel)
    const count = await list.count().catch(() => 0)
    for (let i = 0; i < Math.min(count, 40); i++) {
      const loc = list.nth?.(i) ?? (i === 0 ? list.first() : null)
      if (!loc) break
      const text = ((await loc.innerText().catch(() => '')) || '').trim()
      if (text) pushUnique(text, loc)
    }
  }

  return found
}

async function clickLabelAnywhere(ctx: PlaybookContext, label: string): Promise<boolean> {
  const page = ctx.session?.page
  if (!page) return false
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const exact = new RegExp(`^\\s*${escaped}\\s*$`, 'i')
  const quoted = label.replace(/"/g, '\\"')

  // Prefer frame-aware lookups — dropdown options live in the eligibility iframe.
  const frameSelectors = [
    `[role="option"]:has-text("${quoted}")`,
    `.dropdown-item:has-text("${quoted}")`,
    `.av-select__option:has-text("${quoted}")`,
    `li:has-text("${quoted}")`,
    `button:has-text("${quoted}")`,
    `div[class*="option"]:has-text("${quoted}")`,
  ]
  for (const sel of frameSelectors) {
    const loc = await ctx.session?.findLocator?.(sel, 2_500)
    if (loc) {
      await loc.scrollIntoViewIfNeeded?.().catch(() => undefined)
      await loc.click({ timeout: 10_000 }).catch(() => undefined)
      return true
    }
  }

  const candidates: BrowserLocator[] = [
    page.getByRole('option', { name: exact }).first(),
    page.locator(`[role="option"]:has-text("${quoted}")`).first(),
    page.locator(`.dropdown-item:has-text("${quoted}")`).first(),
    page.locator(`.av-select__option:has-text("${quoted}")`).first(),
  ]
  if (page.getByText) {
    candidates.push(page.getByText(exact).first())
    candidates.push(page.getByText(label, { exact: true }).first())
  }
  for (const el of candidates) {
    if ((await el.count().catch(() => 0)) > 0) {
      await el.scrollIntoViewIfNeeded?.().catch(() => undefined)
      await el.click({ timeout: 10_000 }).catch(() => undefined)
      return true
    }
  }
  return false
}

async function selectTypeaheadOption(
  ctx: PlaybookContext,
  params: {
    fieldSelectors: string[]
    searchTerms: string[]
    matches: (label: string) => boolean
    score?: (label: string) => number | null
    fieldLabel: string
    /** When set, also try clicking this exact expected label via getByText (Other Payers). */
    preferredLabels?: string[]
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

  const pickBest = (labels: string[]): string | null => {
    if (params.score) {
      let best: { label: string; score: number } | null = null
      for (const label of labels) {
        const score = params.score(label)
        if (score == null) continue
        if (!best || score > best.score) best = { label, score }
      }
      return best?.label ?? null
    }
    return labels.find((l) => params.matches(l)) || null
  }

  const dropdownStillOpen = async (): Promise<boolean> => {
    const candidates = await collectTypeaheadCandidates(ctx)
    return candidates.length > 0
  }

  const confirmSelection = async (
    clickedLabel: string,
    term: string
  ): Promise<{ ok: true; selectedLabel: string } | null> => {
    // Poll briefly: Availity may leave the menu open for a beat after click/Enter.
    // Brand-equals-label payers (CIGNA) look identical to typed leftover until the menu closes.
    for (let attempt = 0; attempt < 5; attempt++) {
      await page().waitForTimeout(attempt === 0 ? 700 : 350)
      const selected = await readSelected()
      const menuOpen = await dropdownStillOpen()

      if (
        selected &&
        params.matches(selected) &&
        !isUncommittedTypeaheadValue({
          selected,
          typedTerm: term,
          dropdownStillOpen: menuOpen,
        })
      ) {
        ctx.log(`Selected Availity ${params.fieldLabel}`, {
          term,
          selected,
          clickedLabel,
          menuOpen,
        })
        return { ok: true, selectedLabel: selected }
      }

      // Chip/cleared input after a real option click — accept clicked label only then.
      if (!selected && !menuOpen && params.matches(clickedLabel)) {
        ctx.log(`Selected Availity ${params.fieldLabel} (chip/cleared input)`, {
          term,
          clickedLabel,
        })
        return { ok: true, selectedLabel: clickedLabel }
      }

      // Menu still open with typed leftover — keep waiting for commit animation.
      if (
        selected &&
        isUncommittedTypeaheadValue({
          selected,
          typedTerm: term,
          dropdownStillOpen: menuOpen,
        })
      ) {
        continue
      }

      // Never accept a committed value that does not itself match the CRM payer
      // (e.g. clicked BCBS Texas but field stuck on BLUE CROSS MEDICARE ADVANTAGE).
      if (selected && !params.matches(selected) && !menuOpen) {
        return null
      }
    }

    return null
  }

  const tryCommitWithKeyboard = async (
    bestLabel: string,
    term: string
  ): Promise<{ ok: true; selectedLabel: string } | null> => {
    // Focus is on the typeahead input; ArrowDown+Enter matches the manual recording path
    // (type CIGNA → Frequently Used Payers → Enter).
    const kb = page().keyboard
    if (!kb?.press) return null
    const input = await findInputBySelectors(ctx, params.fieldSelectors)
    if (!input) return null
    await input.click({ timeout: 5_000 }).catch(() => undefined)
    await kb.press('ArrowDown').catch(() => undefined)
    await page().waitForTimeout(250)
    await kb.press('Enter').catch(() => undefined)
    const confirmed = await confirmSelection(bestLabel, term)
    if (confirmed) return confirmed
    // Keyboard may commit a matching label even when candidate scraping missed it.
    const selected = await readSelected()
    const menuOpen = await dropdownStillOpen()
    if (
      selected &&
      params.matches(selected) &&
      !isUncommittedTypeaheadValue({
        selected,
        typedTerm: term,
        dropdownStillOpen: menuOpen,
      })
    ) {
      return { ok: true, selectedLabel: selected }
    }
    return null
  }

  // Preferred labels: try as click targets after a short brand search, not as typed full strings.
  // (Typing the full normalized name often fails to open a useful Availity list.)

  for (const term of params.searchTerms) {
    if (!term) continue
    const input = await findInputBySelectors(ctx, params.fieldSelectors)
    if (!input) break

    await input.click({ timeout: 10_000 }).catch(() => undefined)
    await input.fill('').catch(() => undefined)
    await input.fill(term)
    await page().waitForTimeout(1400)

    const candidates = await collectTypeaheadCandidates(ctx)
    ctx.log(`Availity ${params.fieldLabel} candidates`, {
      term,
      count: candidates.length,
      labels: candidates.slice(0, 8).map((c) => c.label),
    })

    const preferredHit = (params.preferredLabels || [])
      .map((p) => pickBest([p, ...candidates.map((c) => c.label)].filter(Boolean)))
      .find(Boolean)
    const bestLabel =
      pickBest(candidates.map((c) => c.label)) ||
      preferredHit ||
      (params.preferredLabels || []).find((p) => params.matches(p)) ||
      null
    if (!bestLabel) {
      // Keyboard select first highlighted option when list is open but unreadable.
      const viaKeys = await tryCommitWithKeyboard(term, term)
      if (viaKeys && params.matches(viaKeys.selectedLabel)) return viaKeys
      continue
    }

    const bestCandidate = candidates.find(
      (c) => compactPayerText(c.label) === compactPayerText(bestLabel)
    )
    let clicked = false
    if (bestCandidate) {
      await bestCandidate.locator.scrollIntoViewIfNeeded?.().catch(() => undefined)
      await bestCandidate.locator.click({ timeout: 10_000 }).catch(() => undefined)
      clicked = true
    }
    if (!clicked) {
      clicked = await clickLabelAnywhere(ctx, bestLabel)
    }

    if (clicked) {
      const confirmed = await confirmSelection(bestLabel, term)
      if (confirmed) return confirmed
    }

    const viaKeys = await tryCommitWithKeyboard(bestLabel, term)
    if (viaKeys) return viaKeys
  }

  // Last attempt: scan currently visible options (Other Payers / open list) without retyping.
  const visible = await collectTypeaheadCandidates(ctx)
  const bestVisible = pickBest(visible.map((c) => c.label))
  if (bestVisible) {
    const hit = visible.find((c) => compactPayerText(c.label) === compactPayerText(bestVisible))
    if (hit) {
      await hit.locator.click({ timeout: 10_000 }).catch(() => undefined)
      const confirmed = await confirmSelection(bestVisible, bestVisible)
      if (confirmed) return confirmed
    }
    if (await clickLabelAnywhere(ctx, bestVisible)) {
      const confirmed = await confirmSelection(bestVisible, bestVisible)
      if (confirmed) return confirmed
    }
  }

  const leftover = await readSelected()
  // Never treat uncommitted typed leftover as success — even if it fuzzy-matches.
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
  const normalized = normalizePayerText(payerName)
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
    score: (label) => scorePayerLabel(label, payerName),
    preferredLabels: uniqueStrings([normalized, payerName, payerId || '']),
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
  const newRequest =
    (await ctx.session!.findLocator?.(
      'button:has-text("New Request"), a:has-text("New Request"), [role="button"]:has-text("New Request")',
      3_000
    )) || null
  if (newRequest) {
    await newRequest.click({ timeout: 10_000 }).catch(() => undefined)
  } else {
    await clickFirstMatch(page(), [
      page().getByRole('button', { name: /new request/i }).first(),
      page().locator('button:has-text("New Request")').first(),
      page().locator('a:has-text("New Request")').first(),
    ])
  }
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
  // Availity often shows an NPI suggestion chip under the field — click to commit it.
  if (filledNpi && npi) {
    const npiChip =
      (await ctx.session!.findLocator?.(
        `[role="option"]:has-text("${npi}"), .dropdown-item:has-text("${npi}"), button:has-text("${npi}"), [class*="option"]:has-text("${npi}")`,
        2_000
      )) || null
    if (npiChip) {
      await npiChip.click({ timeout: 5_000 }).catch(() => undefined)
      ctx.log('Confirmed Availity provider NPI chip', { npi })
    } else if (page().keyboard?.press) {
      await page().keyboard!.press!('Enter').catch(() => undefined)
    }
  }
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
  // Scope interpretation to this member so a prior patient's "Active Coverage" in the
  // history rail cannot mark the run successful.
  const interpretOpts = { memberId, patientLastName: lastName }
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
        output: { pageSnippet: bodyText.slice(0, 12_000), url: page().url() },
      }
    }

    const interpreted = interpretAvailityEligibilityText(bodyText, interpretOpts)
    if (interpreted.eligibilityStatus !== 'unknown') {
      eligibilityStatus = interpreted.eligibilityStatus
      resultMessage = interpreted.message
      // On apparent active, wait one extra beat for AAA rejection text to arrive.
      if (eligibilityStatus === 'active') {
        await page().waitForTimeout(2500)
        bodyText =
          (await ctx.session.collectTextAcrossFrames?.()) ||
          (await page().locator('body').innerText().catch(() => '')) ||
          bodyText
        const again = interpretAvailityEligibilityText(bodyText, interpretOpts)
        eligibilityStatus = again.eligibilityStatus
        resultMessage = again.message
      }
      break
    }
  }

  // Results header alone is not enough — Plan Maximums / copay rows are below the fold.
  if (eligibilityStatus === 'active' || eligibilityStatus === 'inactive') {
    bodyText = await enrichAvailityResultText(ctx, bodyText)
    // Re-check after enrichment — AAA errors / member-scoped status may only be clear then.
    const afterEnrich = interpretAvailityEligibilityText(bodyText, interpretOpts)
    eligibilityStatus = afterEnrich.eligibilityStatus
    resultMessage = afterEnrich.message || resultMessage
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
        pageSnippet: bodyText.slice(0, 12_000),
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
        pageSnippet: bodyText.slice(0, 12_000),
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
  ctx.log('Scraped Availity rheum packet', {
    planType: rheum.planType,
    networkStatus: rheum.networkStatus,
    specialistCopay: rheum.specialistCopay,
    deductible: rheum.deductible,
    coinsurance: rheum.coinsurance,
    oop: rheum.oop,
    authRequired: rheum.authRequired,
    unknownFields: rheum.unknownFields,
  })

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
      pageSnippet: bodyText.slice(0, 12_000),
      url: page().url(),
      selectedPayerLabel,
    },
    artifactUrls: artifacts,
  }
}

/**
 * After Active/Inactive status appears, click network filter + scroll so Plan Maximums,
 * deductible/OOP rows, and specialist benefits are included in collected text.
 * Expand targets / network filter come from the practice-level playbook config.
 */
async function enrichAvailityResultText(
  ctx: PlaybookContext,
  initialText: string
): Promise<string> {
  if (!ctx.session) return initialText
  const page = () => ctx.session!.page
  let best = initialText
  const config: AvailityEligibilityPlaybookConfig = practicePlaybookConfigFromInput(ctx.input)
  const capture = config.resultCapture

  ctx.log('Using practice playbook resultCapture', {
    version: config.version,
    networkFilter: capture.networkFilter,
    scrollPasses: capture.scrollPasses,
    expandLabels: capture.expandLabels,
  })

  const clickFilter = async (label: string) => {
    const loc =
      (await ctx.session!.findLocator?.(
        `button:has-text("${label}"), [role="button"]:has-text("${label}"), [role="tab"]:has-text("${label}"), label:has-text("${label}")`,
        2_000
      )) || null
    if (!loc) return false
    await loc.click({ timeout: 5_000 }).catch(() => undefined)
    await page().waitForTimeout(1200)
    return true
  }

  const networkFilter = capture.networkFilter || 'In Network'
  const clickedFilter = await clickFilter(networkFilter)
  if (!clickedFilter && networkFilter === 'In Network') {
    await clickFilter('In-Network')
  }

  // Jump toward the amounts section when the heading is present.
  const planMax =
    (await ctx.session.findLocator?.(
      'text=/Plan Maximums and Deductibles/i, text=/Annual Deductible/i, text=/Specialist/i',
      2_000
    )) || null
  if (planMax) {
    await planMax.scrollIntoViewIfNeeded?.().catch(() => undefined)
    await planMax.click({ timeout: 3_000 }).catch(() => undefined)
  }

  const scrollPasses = capture.scrollPasses || 6
  for (let i = 0; i < scrollPasses; i++) {
    await page().keyboard?.press?.('PageDown').catch(() => undefined)
    await page().waitForTimeout(500)
    const text =
      (await ctx.session.collectTextAcrossFrames?.()) ||
      (await page().locator('body').innerText().catch(() => '')) ||
      ''
    if (text.length > best.length) best = text
    // Stop early once we see Individual deductible/OOP dollars.
    if (
      /annual\s+deductible/i.test(text) &&
      /\$\s*[\d,]+(?:\.\d{2})?/.test(text) &&
      /is\s+remaining|out[- ]of[- ]pocket|\$[\d,.]+\s+remaining/i.test(text)
    ) {
      best = text
      break
    }
  }

  // Expand practice-configured Benefit Information tabs/rows for copay and coinsurance.
  for (const label of capture.expandLabels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const row =
      (await ctx.session.findLocator?.(
        `button:has-text("${label.replace(/"/g, '\\"')}"), [role="button"]:has-text("${label.replace(
          /"/g,
          '\\"'
        )}"), a:has-text("${label.replace(/"/g, '\\"')}"), text=/${escaped}/i`,
        1_500
      )) || null
    if (!row) continue
    await row.scrollIntoViewIfNeeded?.().catch(() => undefined)
    await row.click({ timeout: 3_000 }).catch(() => undefined)
    await page().waitForTimeout(800)
    const text =
      (await ctx.session.collectTextAcrossFrames?.()) ||
      (await page().locator('body').innerText().catch(() => '')) ||
      ''
    if (text.length > best.length) best = text
  }

  ctx.log('Enriched Availity result text', {
    initialLen: initialText.length,
    enrichedLen: best.length,
    hasAnnualDeductible: /annual\s+deductible/i.test(best),
    hasOop: /out[- ]of[- ]pocket/i.test(best),
    hasSpecialist: /specialist/i.test(best),
    expandLabelCount: capture.expandLabels.length,
  })
  return best
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
