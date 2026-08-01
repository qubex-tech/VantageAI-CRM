import type { ParsedEligibilitySummary } from '@/lib/availity'
import { generateTotp } from '../totp'
import { markBrowserCredentialLogin } from '../credentials'
import type { BrowserPlaybook, PlaybookContext, PlaybookResult } from '../types'

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

async function loginAvaility(ctx: PlaybookContext): Promise<PlaybookResult | null> {
  if (!ctx.credential || !ctx.session) {
    return { ok: false, errorMessage: 'Missing Availity portal credentials or browser session' }
  }

  const { page } = ctx.session
  const { credential } = ctx

  try {
    await page.goto(AVAILITY_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Availity rotates login markup; try common field names then fall back to placeholders.
    const userSelectors = [
      'input[name="userId"]',
      'input#userId',
      'input[name="username"]',
      'input[autocomplete="username"]',
      'input[type="email"]',
    ]
    const passSelectors = [
      'input[name="password"]',
      'input#password',
      'input[autocomplete="current-password"]',
      'input[type="password"]',
    ]

    let filledUser = false
    for (const sel of userSelectors) {
      const el = page.locator(sel).first()
      if ((await el.count()) > 0) {
        await el.fill(credential.username)
        filledUser = true
        break
      }
    }
    if (!filledUser) {
      return {
        ok: false,
        errorMessage: 'Availity login: username field not found (UI may have changed)',
        escalateToVoice: true,
      }
    }

    let filledPass = false
    for (const sel of passSelectors) {
      const el = page.locator(sel).first()
      if ((await el.count()) > 0) {
        await el.fill(credential.password)
        filledPass = true
        break
      }
    }
    if (!filledPass) {
      return {
        ok: false,
        errorMessage: 'Availity login: password field not found (UI may have changed)',
        escalateToVoice: true,
      }
    }

    const submit = page.locator(
      'button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Log In")'
    ).first()
    await submit.click({ timeout: 15_000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 45_000 }).catch(() => undefined)

    // MFA / TOTP
    const mfaInput = page.locator(
      'input[name="otp"], input[name="code"], input[autocomplete="one-time-code"], input[placeholder*="code" i]'
    ).first()
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
      await mfaInput.fill(code)
      const mfaSubmit = page.locator('button[type="submit"], button:has-text("Verify"), button:has-text("Continue")').first()
      await mfaSubmit.click({ timeout: 15_000 })
      await page.waitForLoadState('domcontentloaded', { timeout: 45_000 }).catch(() => undefined)
    }

    // Captcha / challenge walls
    const bodyText = ((await page.locator('body').innerText().catch(() => '')) || '').toLowerCase()
    if (
      bodyText.includes('captcha') ||
      bodyText.includes('unusual activity') ||
      bodyText.includes('verify you are human')
    ) {
      await markBrowserCredentialLogin(credential.id, { ok: false, error: 'captcha_or_challenge' })
      return {
        ok: false,
        errorMessage: 'Availity presented a CAPTCHA/challenge wall',
        escalateToVoice: true,
      }
    }

    await markBrowserCredentialLogin(credential.id, { ok: true })
    ctx.log('Availity login succeeded')
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

  // Navigate to Eligibility & Benefits — try deep link then menu text.
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

  const memberId = asString(ctx.input.memberId)
  const payerName = asString(ctx.input.payerName)
  const firstName = asString(ctx.input.patientFirstName)
  const lastName = asString(ctx.input.patientLastName)
  const dob = asString(ctx.input.patientDob) // YYYY-MM-DD
  const npi = asString(ctx.input.providerNpi)

  const fillFirst = async (selectors: string[], value: string) => {
    if (!value) return false
    for (const sel of selectors) {
      const el = page.locator(sel).first()
      if ((await el.count()) > 0) {
        await el.fill(value)
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
    ['input[name="patientBirthDate"]', 'input[type="date"]', 'input[id*="dob" i]', 'input[placeholder*="Birth" i]'],
    dob
  )
  await fillFirst(
    ['input[name="providerNpi"]', 'input[id*="npi" i]', 'input[placeholder*="NPI" i]'],
    npi
  )

  // Payer is often a typeahead — fill and pick first option
  if (payerName) {
    const payerInput = page.locator(
      'input[name="payer"], input[id*="payer" i], input[placeholder*="Payer" i]'
    ).first()
    if ((await payerInput.count()) > 0) {
      await payerInput.fill(payerName)
      await page.waitForTimeout(800)
      const option = page.locator('[role="option"], .dropdown-item, li').first()
      if ((await option.count()) > 0) {
        await option.click().catch(() => undefined)
      }
    }
  }

  const submit = page.locator(
    'button:has-text("Submit"), button:has-text("Check Eligibility"), button[type="submit"]'
  ).first()
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
