import type { Practice } from '@prisma/client'

function stripTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * Portal origin selection:
 * - Prefer explicit env override (useful for staging/local)
 * - Otherwise use practice subdomain when available
 * - Fallback to shared portal domain
 */
export function getPortalOriginForPractice(practice?: Pick<Practice, 'slug'> | null): string {
  const envOrigin =
    process.env.NEXT_PUBLIC_PORTAL_ORIGIN ||
    process.env.PORTAL_ORIGIN ||
    process.env.NEXT_PUBLIC_PORTAL_BASE_URL

  if (envOrigin) return stripTrailingSlash(envOrigin)

  const slug = practice?.slug?.trim()
  if (slug) return `https://${slug}.portal.getvantage.tech`

  return 'https://portal.getvantage.tech'
}

/**
 * Verified patient URL (secure invite link).
 * This is the URL that should be inserted into email/SMS templates.
 */
export function buildVerifiedPatientPortalUrl(params: {
  practice?: Pick<Practice, 'slug'> | null
  inviteToken: string
}): string {
  const origin = getPortalOriginForPractice(params.practice)
  return `${origin}/portal/invite?token=${encodeURIComponent(params.inviteToken)}`
}

