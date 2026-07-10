/**
 * Unwrap AWS SES click-tracking URLs when a custom tracking domain
 * points at the app (e.g. app.getvantage.tech/CL0/...).
 *
 * SES rewrites links to:
 *   https://{tracking-domain}/CL0/{url-encoded-destination}/1/{message-id}/{signature}
 *
 * If those land on the Next.js app instead of SES infrastructure, auth
 * recovery / magic links break — decode and redirect to the real target.
 */

const SES_TRACKER_TAIL = /\/\d+\//

function isTrustedSesDestination(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.supabase.co')) return true
  if (host === 'getvantage.tech' || host.endsWith('.getvantage.tech')) return true
  return false
}

export function unwrapSesClickTrackingPath(pathname: string): string | null {
  if (!pathname.startsWith('/CL0/')) return null

  const afterPrefix = pathname.slice('/CL0/'.length)
  const trackerMatch = SES_TRACKER_TAIL.exec(afterPrefix)
  const encoded = trackerMatch
    ? afterPrefix.slice(0, trackerMatch.index)
    : afterPrefix

  if (!encoded) return null

  let destination: string
  try {
    destination = decodeURIComponent(encoded)
  } catch {
    return null
  }

  if (!/^https?:\/\//i.test(destination)) return null

  let parsed: URL
  try {
    parsed = new URL(destination)
  } catch {
    return null
  }

  if (!isTrustedSesDestination(parsed)) return null

  return destination
}

export function unwrapSesClickTrackingUrl(url: URL): URL | null {
  const destination = unwrapSesClickTrackingPath(url.pathname)
  if (!destination) return null
  return new URL(destination)
}
