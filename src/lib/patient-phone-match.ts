import { prisma } from '@/lib/db'
import {
  normalizeDobToIso,
  patientDobMatches,
} from '@/lib/patient-identity'

export function normalizePhoneDigits(value?: string | null): string {
  if (!value) return ''
  return String(value).replace(/[^\d]/g, '')
}

export function getPhoneLast10(value?: string | null): string {
  const digits = normalizePhoneDigits(value)
  return digits.length >= 10 ? digits.slice(-10) : digits
}

export function phoneNumbersMatchLoosely(
  a?: string | null,
  b?: string | null
): boolean {
  const digitsA = normalizePhoneDigits(a)
  const digitsB = normalizePhoneDigits(b)
  if (!digitsA || !digitsB) return false
  if (digitsA === digitsB) return true
  const last10A = digitsA.slice(-10)
  const last10B = digitsB.slice(-10)
  return last10A.length === 10 && last10B.length === 10 && last10A === last10B
}

function patientPhoneLast10Values(patient: {
  phone: string | null
  primaryPhone: string | null
  secondaryPhone: string | null
}): string[] {
  return [patient.phone, patient.primaryPhone, patient.secondaryPhone]
    .filter(Boolean)
    .map((num) => getPhoneLast10(String(num)))
    .filter((digits) => digits.length === 10)
}

/** Whether a patient's stored numbers match an inbound SMS reply number. */
export function patientMatchesReplyPhone(
  patient: {
    phone: string | null
    primaryPhone: string | null
    secondaryPhone: string | null
  },
  replyFrom: string
): boolean {
  const fromLast10 = getPhoneLast10(replyFrom)
  if (fromLast10.length < 10) return false
  return patientPhoneLast10Values(patient).includes(fromLast10)
}

const patientSelect = {
  id: true,
  practiceId: true,
  name: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  phone: true,
  primaryPhone: true,
  secondaryPhone: true,
} as const

export type PatientPhoneMatch = {
  id: string
  practiceId: string
  name: string
  firstName: string | null
  lastName: string | null
  dateOfBirth: Date | null
  phone: string | null
  primaryPhone: string | null
  secondaryPhone: string | null
}

function matchesLast10(
  patient: {
    phone: string | null
    primaryPhone: string | null
    secondaryPhone: string | null
  },
  fromLast10: string
) {
  return patientPhoneLast10Values(patient).includes(fromLast10)
}

export function pickPatientMatchForInbound(
  matches: PatientPhoneMatch[],
  preferPracticeIds?: string[]
): PatientPhoneMatch | null {
  if (matches.length === 0) return null
  if (!preferPracticeIds?.length) return matches[0]

  for (const practiceId of preferPracticeIds) {
    const preferred = matches.find((patient) => patient.practiceId === practiceId)
    if (preferred) return preferred
  }

  return matches[0]
}

export async function findPatientBySmsPhone(params: {
  from: string
  practiceId?: string | null
  preferPracticeIds?: string[]
  /** When set, only consider patients in these practices (no global fallback). */
  onlyPracticeIds?: string[]
  /** Disambiguate when multiple patients share the phone in one practice. */
  preferredPatientId?: string | null
  dateOfBirth?: string | Date | null
}): Promise<PatientPhoneMatch | null> {
  const fromLast10 = getPhoneLast10(params.from)
  if (fromLast10.length < 10) {
    return null
  }

  const practiceIdsToTry = params.onlyPracticeIds?.length
    ? [...params.onlyPracticeIds]
    : [
        ...(params.practiceId ? [params.practiceId] : []),
        ...(params.preferPracticeIds || []).filter(
          (id) => id && id !== params.practiceId
        ),
      ]

  for (const practiceId of practiceIdsToTry) {
    const scoped = await prisma.patient.findMany({
      where: {
        practiceId,
        deletedAt: null,
      },
      select: patientSelect,
      take: 500,
    })
    const matches = scoped.filter((patient) => matchesLast10(patient, fromLast10))
    const picked = pickScopedPhoneMatch(matches, {
      preferredPatientId: params.preferredPatientId,
      dateOfBirth: params.dateOfBirth,
    })
    if (picked) return picked
  }

  if (params.onlyPracticeIds?.length) {
    return null
  }

  const globalCandidates = await prisma.patient.findMany({
    where: {
      deletedAt: null,
      OR: [
        { phone: { contains: fromLast10 } },
        { primaryPhone: { contains: fromLast10 } },
        { secondaryPhone: { contains: fromLast10 } },
      ],
    },
    select: patientSelect,
    take: 100,
  })

  const matches = globalCandidates.filter((patient) => matchesLast10(patient, fromLast10))
  const scopedPick = pickScopedPhoneMatch(matches, {
    preferredPatientId: params.preferredPatientId,
    dateOfBirth: params.dateOfBirth,
  })
  if (scopedPick) return scopedPick
  return pickPatientMatchForInbound(matches, params.preferPracticeIds || practiceIdsToTry)
}

export function pickScopedPhoneMatch(
  matches: PatientPhoneMatch[],
  params: { preferredPatientId?: string | null; dateOfBirth?: string | Date | null }
): PatientPhoneMatch | null {
  if (matches.length === 0) return null
  if (params.preferredPatientId) {
    const preferred = matches.find((p) => p.id === params.preferredPatientId)
    if (preferred) return preferred
  }
  if (matches.length === 1) return matches[0]

  const dob = normalizeDobToIso(params.dateOfBirth)
  if (dob) {
    const identityMatches = matches.filter((p) => patientDobMatches(p, dob))
    if (identityMatches.length === 1) return identityMatches[0]
  }

  // Same phone, different people (e.g. two Steve Maddens) — do not guess.
  return null
}
