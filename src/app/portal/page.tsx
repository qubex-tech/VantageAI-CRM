import { redirect } from 'next/navigation'

/**
 * Portal Home Page
 * Redirects to auth if not logged in, otherwise shows home
 */
export default function PortalHomePage() {
  redirect('/portal/auth')
}
