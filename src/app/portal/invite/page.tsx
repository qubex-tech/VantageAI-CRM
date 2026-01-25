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

  const invite = await verifyInviteTokenAnyPractice(token)

  if (!invite) {
    redirect('/portal/auth?error=invalid_invite')
  }

  const cookieStore = await cookies()
  cookieStore.set('portal_invite', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  })

  redirect('/portal/auth')
}

