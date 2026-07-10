import { describe, expect, it } from 'vitest'
import {
  unwrapSesClickTrackingPath,
  unwrapSesClickTrackingUrl,
} from '@/lib/ses-click-tracking'

describe('unwrapSesClickTrackingPath', () => {
  const destination =
    'https://ghzbondhdjashchkkymg.supabase.co/auth/v1/verify?token=pkce_abc&type=recovery&redirect_to=https%3A%2F%2Fapp.getvantage.tech%2Freset-password'
  const encoded = encodeURIComponent(destination)

  it('unwraps SES /CL0/ paths with tracker suffix', () => {
    const path = `/CL0/${encoded}/1/0100019f495af074-70e55280-4060-4e8a-a8aa-b0ee1ac5649e-000000/g6QJhf5Dcm3LAR87riURu2W4OwnHnscovDS2u35xbkY=452`
    expect(unwrapSesClickTrackingPath(path)).toBe(destination)
  })

  it('unwraps SES /CL0/ paths without tracker suffix', () => {
    expect(unwrapSesClickTrackingPath(`/CL0/${encoded}`)).toBe(destination)
  })

  it('returns null for non-tracking paths', () => {
    expect(unwrapSesClickTrackingPath('/reset-password')).toBeNull()
    expect(unwrapSesClickTrackingPath('/CL0/')).toBeNull()
  })

  it('rejects non-http destinations', () => {
    expect(unwrapSesClickTrackingPath('/CL0/javascript:alert(1)')).toBeNull()
    expect(unwrapSesClickTrackingPath(`/CL0/${encodeURIComponent('ftp://evil.example')}`)).toBeNull()
  })

  it('rejects untrusted http destinations (open-redirect guard)', () => {
    expect(
      unwrapSesClickTrackingPath(`/CL0/${encodeURIComponent('https://evil.example/phish')}`)
    ).toBeNull()
  })
})

describe('unwrapSesClickTrackingUrl', () => {
  it('returns a URL object for valid SES wrappers', () => {
    const dest =
      'https://ghzbondhdjashchkkymg.supabase.co/auth/v1/verify?token=pkce_abc&type=recovery&redirect_to=https://app.getvantage.tech/reset-password'
    const wrapped = new URL(
      `https://app.getvantage.tech/CL0/${encodeURIComponent(dest)}/1/msg/sig=1`
    )
    const unwrapped = unwrapSesClickTrackingUrl(wrapped)
    expect(unwrapped?.toString()).toBe(dest)
  })
})
