import { NextRequest, NextResponse } from 'next/server'
import { verifyInviteTokenAnyPractice } from '@/lib/patient-auth'

export const dynamic = 'force-dynamic'

function extractInviteToken(raw: string): string | null {
  // Our current invite tokens are 32-byte hex strings (64 chars).
  const match = raw.toLowerCase().match(/[0-9a-f]{64}/)
  return match ? match[0] : null
}

/**
 * GET /portal/invite?token=...
 *
 * Route handler (not a page) so we can set cookies in production.
 */
export async function GET(req: NextRequest) {
  const tokenParam = req.nextUrl.searchParams.get('token')

  if (!tokenParam) {
    return NextResponse.redirect(new URL('/portal/auth?error=invite_required', req.url))
  }

  const normalizedToken = extractInviteToken(tokenParam) || tokenParam

  let invite: Awaited<ReturnType<typeof verifyInviteTokenAnyPractice>>
  try {
    invite = await verifyInviteTokenAnyPractice(normalizedToken)
  } catch (e) {
    console.error('[portal/invite] verifyInviteTokenAnyPractice failed:', e)
    return NextResponse.redirect(new URL('/portal/auth?error=invite_verify_failed', req.url))
  }

  if (!invite) {
    return NextResponse.redirect(new URL('/portal/auth?error=invalid_invite', req.url))
  }

  const res = NextResponse.redirect(new URL('/portal/auth', req.url))
  res.cookies.set('portal_invite', normalizedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  })
  return res
}

