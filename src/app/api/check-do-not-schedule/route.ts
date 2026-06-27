import { NextRequest, NextResponse } from 'next/server'
import { verifyRetellSignature, rateLimit } from '@/lib/middleware'
import { isOnDoNotScheduleList } from '@/lib/do-not-schedule'

/**
 * Retell custom-function endpoint: Do Not Schedule lookup.
 *
 * Retell calls this during a live call to check whether the caller is on our
 * Do Not Schedule list. Per https://docs.retellai.com/build/single-multi-prompt/custom-function
 * the body is `{ name, call, args }` and the response is stringified and fed
 * back to the LLM.
 *
 * Behavior:
 * - Verifies the `X-Retell-Signature` header (same scheme as the Retell webhook).
 * - Fails open (returns `{ on_do_not_schedule_list: false }`) on malformed or
 *   incomplete requests so a bad payload never blocks scheduling.
 * - Logs only the boolean outcome — never patient PII (name / DOB).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(`check-do-not-schedule:${ip}`, 200, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.text()
    const signature =
      req.headers.get('x-retell-signature') ||
      req.headers.get('x-retell-signature-256') ||
      req.headers.get('x-retell-signature-v1') ||
      req.headers.get('retell-signature') ||
      req.headers.get('retell-signature-256') ||
      req.headers.get('retell-signature-v1') ||
      req.headers.get('x-signature') ||
      req.headers.get('x-hub-signature-256') ||
      ''

    if (!body?.trim()) {
      console.warn('[check-do-not-schedule] Empty request body received')
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    }

    // Verify signature (skip when RETELLAI_SKIP_SIGNATURE_VERIFICATION=1 for local testing).
    const skipVerification = process.env.RETELLAI_SKIP_SIGNATURE_VERIFICATION === '1'
    const secrets = [
      process.env.RETELL_API_KEY,
      process.env.RETELLAI_WEBHOOK_SECRET,
      ...(process.env.RETELL_API_KEYS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ].filter(Boolean) as string[]

    if (!skipVerification && secrets.length === 0) {
      return NextResponse.json(
        { error: 'Missing Retell API key for signature verification' },
        { status: 401 }
      )
    }

    let payload: { name?: string; call?: unknown; args?: Record<string, unknown> }
    try {
      payload = JSON.parse(body)
    } catch {
      // Fail open: a body we can't parse should not block scheduling.
      console.warn('[check-do-not-schedule] Could not parse request body as JSON; failing open')
      return NextResponse.json({ on_do_not_schedule_list: false }, { status: 200 })
    }

    if (!skipVerification && secrets.length > 0) {
      let verified = false
      for (const secret of secrets) {
        if (verifyRetellSignature(body, signature, secret)) {
          verified = true
          break
        }
        // Retell's SDK verifies against JSON.stringify(req.body).
        if (verifyRetellSignature(JSON.stringify(payload), signature, secret)) {
          verified = true
          break
        }
      }
      if (!verified) {
        console.warn('[check-do-not-schedule] Invalid signature', {
          signatureHeaderPresent: Boolean(signature),
          signatureLength: signature.length,
          secretCount: secrets.length,
        })
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const args = payload?.args
    const firstName = args?.first_name
    const lastName = args?.last_name
    const hasRequiredFields =
      typeof firstName === 'string' &&
      firstName.trim().length > 0 &&
      typeof lastName === 'string' &&
      lastName.trim().length > 0

    if (!hasRequiredFields) {
      // Fail open so an incomplete request never blocks scheduling. Note: we
      // intentionally do NOT log the args themselves (PII).
      console.warn(
        '[check-do-not-schedule] Missing required args (first_name/last_name); failing open'
      )
      return NextResponse.json({ on_do_not_schedule_list: false }, { status: 200 })
    }

    const onList = isOnDoNotScheduleList({
      firstName,
      lastName,
      dateOfBirth: args?.date_of_birth,
    })

    // Log only the boolean outcome — never the caller's name or DOB.
    console.log(`[check-do-not-schedule] lookup complete on_list=${onList}`)

    return NextResponse.json({ on_do_not_schedule_list: onList }, { status: 200 })
  } catch (error) {
    // Fail open on unexpected errors so scheduling isn't blocked by a server hiccup.
    console.error('[check-do-not-schedule] error:', error)
    return NextResponse.json({ on_do_not_schedule_list: false }, { status: 200 })
  }
}

// Retell "Test" can issue a GET request; respond with a simple 200.
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
