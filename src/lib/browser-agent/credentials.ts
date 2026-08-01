import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import type { DecryptedBrowserCredential } from './types'

function safeDecrypt(payload: string | null | undefined): string | null {
  if (!payload?.trim()) return null
  try {
    return decryptString(payload)
  } catch {
    return null
  }
}

export async function getBrowserCredential(
  practiceId: string,
  site: string
): Promise<DecryptedBrowserCredential | null> {
  const row = await prisma.browserCredential.findUnique({
    where: { practiceId_site: { practiceId, site } },
  })
  if (!row || !row.isActive) return null

  const password = safeDecrypt(row.passwordEnc)
  if (!password) return null

  let extra: Record<string, unknown> | null = null
  const extraRaw = safeDecrypt(row.extraEnc)
  if (extraRaw) {
    try {
      extra = JSON.parse(extraRaw) as Record<string, unknown>
    } catch {
      extra = null
    }
  }

  return {
    id: row.id,
    practiceId: row.practiceId,
    site: row.site,
    username: row.username,
    password,
    totpSecret: safeDecrypt(row.totpSecretEnc),
    extra,
  }
}

export async function upsertBrowserCredential(params: {
  practiceId: string
  site: string
  username: string
  password?: string
  totpSecret?: string | null
  isActive?: boolean
  clearTotpSecret?: boolean
}) {
  const existing = await prisma.browserCredential.findUnique({
    where: {
      practiceId_site: { practiceId: params.practiceId, site: params.site },
    },
  })

  const data: {
    username: string
    passwordEnc?: string
    totpSecretEnc?: string | null
    isActive?: boolean
    lastError?: string | null
  } = {
    username: params.username.trim(),
  }

  if (params.password?.trim()) {
    data.passwordEnc = encryptString(params.password.trim())
  } else if (!existing) {
    throw new Error('Password is required when creating browser credentials')
  }

  if (params.clearTotpSecret) {
    data.totpSecretEnc = null
  } else if (params.totpSecret !== undefined) {
    data.totpSecretEnc = params.totpSecret?.trim()
      ? encryptString(params.totpSecret.trim())
      : null
  }

  if (params.isActive !== undefined) data.isActive = params.isActive

  return prisma.browserCredential.upsert({
    where: {
      practiceId_site: { practiceId: params.practiceId, site: params.site },
    },
    create: {
      practiceId: params.practiceId,
      site: params.site,
      username: data.username,
      passwordEnc: data.passwordEnc!,
      totpSecretEnc: data.totpSecretEnc ?? null,
      isActive: data.isActive ?? true,
    },
    update: data,
  })
}

export function redactBrowserCredential(row: {
  passwordEnc?: string | null
  totpSecretEnc?: string | null
  extraEnc?: string | null
  [key: string]: unknown
} | null) {
  if (!row) return null
  return {
    ...row,
    passwordEnc: undefined,
    totpSecretEnc: undefined,
    extraEnc: undefined,
    hasPassword: Boolean(row.passwordEnc),
    hasTotpSecret: Boolean(row.totpSecretEnc),
  }
}

export async function markBrowserCredentialLogin(
  credentialId: string,
  result: { ok: boolean; error?: string }
) {
  await prisma.browserCredential.update({
    where: { id: credentialId },
    data: result.ok
      ? { lastLoginAt: new Date(), lastError: null }
      : { lastError: result.error?.slice(0, 500) || 'login_failed' },
  })
}
