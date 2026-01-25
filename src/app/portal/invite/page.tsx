import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyInviteTokenAnyPractice } from '@/lib/patient-auth'

export const dynamic = 'force-dynamic'

/**
 * Token-based portal entrypoint.
 *
 * If the invite token is valid, we store it in an httpOnly cookie and send the
 * user to `/portal/auth` to complete OTP verification.
 */
export default async function PortalInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    redirect('/portal/auth?error=invite_required')
  }

  let invite: Awaited<ReturnType<typeof verifyInviteTokenAnyPractice>>
  try {
    invite = await verifyInviteTokenAnyPractice(token)
  } catch (e) {
    // If verification fails due to a transient server/db issue, fail closed but gracefully.
    console.error('[portal/invite] verifyInviteTokenAnyPractice failed:', e)
    redirect('/portal/auth?error=invalid_invite')
  }

  if (!invite) {
    redirect('/portal/auth?error=invalid_invite')
  }

  try {
    const cookieStore = await cookies()
    cookieStore.set('portal_invite', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    })
  } catch (e) {
    console.error('[portal/invite] failed to set invite cookie:', e)
    redirect('/portal/auth?error=invalid_invite')
  }

  redirect('/portal/auth')
}

