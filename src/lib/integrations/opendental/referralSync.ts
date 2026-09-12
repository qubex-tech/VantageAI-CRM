import { prisma } from '@/lib/db'
import { createTimelineEntry } from '@/lib/audit'
import { parseDateOnlyString, formatDateOnly } from '@/lib/date'
import { extractPatNumFromExternalId } from './commlogWriteback'
import { getOpenDentalConnection, getOpenDentalServices } from './factory'

export const EHR_REFERRAL_SOURCE_OPENDENTAL = 'opendental'

export type OpenDentalReferralType = 'RefTo' | 'RefFrom' | 'RefCustom'

export type OpenDentalRefAttach = {
  RefAttachNum?: number | string
  ReferralNum?: number | string
  referralName?: string
  PatNum?: number | string
  RefDate?: string
  ReferralType?: string
  RefToStatus?: string
  Note?: string
  ProcNum?: number | string
  ProvNum?: number | string
  DateProcComplete?: string
}

export type OpenDentalReferral = {
  ReferralNum?: number | string
  LName?: string
  FName?: string
  MName?: string
  Title?: string
  specialty?: string
  Telephone?: string
  Phone2?: string
  IsDoctor?: string | boolean
  BusinessName?: string
  NotPerson?: string | boolean
}

export type MappedEhrReferral = {
  externalAttachId: string
  externalReferralId: string | null
  referralType: OpenDentalReferralType
  status: string | null
  referralDate: Date | null
  note: string | null
  specialistName: string | null
  specialistSpecialty: string | null
  specialistPhone: string | null
  specialistTitle: string | null
  isDoctor: boolean | null
  referringProvNum: number | null
  procNum: number | null
}

export type VoiceEhrReferral = {
  referral_type: OpenDentalReferralType
  direction: 'outgoing' | 'incoming' | 'other'
  status: string | null
  date: string | null
  specialist_name: string | null
  specialty: string | null
  phone: string | null
  note: string | null
  speakable_summary: string
}

export type SyncOpenDentalReferralsResult =
  | {
      status: 'success'
      fetched: number
      created: number
      updated: number
      pruned: number
      referrals: MappedEhrReferral[]
    }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string }

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const trimmed = String(value).trim()
  return trimmed.length ? trimmed : null
}

function asNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

function parseOdDate(value: unknown): Date | null {
  const raw = cleanString(value)
  if (!raw || raw.startsWith('0001-01-01')) return null
  const iso = raw.slice(0, 10)
  return parseDateOnlyString(iso)
}

export function normalizeOpenDentalReferralType(value: unknown): OpenDentalReferralType {
  const raw = cleanString(value)
  if (raw === 'RefTo' || raw === 'RefFrom' || raw === 'RefCustom') return raw
  return 'RefCustom'
}

export function formatOpenDentalSpecialistName(
  referral: OpenDentalReferral | null | undefined,
  attachName?: string | null
): string | null {
  const first = cleanString(referral?.FName)
  const last = cleanString(referral?.LName)
  const title = cleanString(referral?.Title)
  const person = [first, last].filter(Boolean).join(' ').trim()
  if (person) {
    return title ? `${person}, ${title}` : person
  }
  const business = cleanString(referral?.BusinessName)
  if (business) return business
  return cleanString(attachName)
}

export function mapOpenDentalRefAttach(
  attach: OpenDentalRefAttach,
  referral?: OpenDentalReferral | null
): MappedEhrReferral | null {
  const attachId = asNumber(attach.RefAttachNum)
  if (attachId == null || attachId <= 0) return null

  const referralNum = asNumber(attach.ReferralNum)
  const procNum = asNumber(attach.ProcNum)
  const provNum = asNumber(attach.ProvNum)

  return {
    externalAttachId: String(attachId),
    externalReferralId: referralNum != null && referralNum > 0 ? String(referralNum) : null,
    referralType: normalizeOpenDentalReferralType(attach.ReferralType),
    status: cleanString(attach.RefToStatus),
    referralDate: parseOdDate(attach.RefDate),
    note: cleanString(attach.Note),
    specialistName: formatOpenDentalSpecialistName(referral, attach.referralName),
    specialistSpecialty: cleanString(referral?.specialty),
    specialistPhone: cleanString(referral?.Telephone) ?? cleanString(referral?.Phone2),
    specialistTitle: cleanString(referral?.Title),
    isDoctor: asBool(referral?.IsDoctor),
    referringProvNum: provNum != null && provNum > 0 ? provNum : null,
    procNum: procNum != null && procNum > 0 ? procNum : null,
  }
}

function humanizeReferralStatus(status: string | null): string | null {
  if (!status || status === 'None') return null
  if (status === 'InTreatment') return 'in treatment'
  return status.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

export function formatEhrReferralSpeakable(referral: {
  referralType: OpenDentalReferralType
  status?: string | null
  referralDate?: Date | string | null
  specialistName?: string | null
  specialistSpecialty?: string | null
}): string {
  const name = cleanString(referral.specialistName) ?? 'a specialist'
  const specialty = cleanString(referral.specialistSpecialty)
  const date =
    referral.referralDate instanceof Date
      ? formatDateOnly(referral.referralDate, 'MMMM d, yyyy')
      : formatDateOnly(referral.referralDate ?? null, 'MMMM d, yyyy')
  const status = humanizeReferralStatus(referral.status ?? null)
  const who = specialty ? `${name}, ${specialty}` : name

  if (referral.referralType === 'RefTo') {
    const parts = [`Referred to ${who}`]
    if (date) parts.push(`on ${date}`)
    let sentence = `${parts.join(' ')}.`
    if (status) sentence += ` Status: ${status}.`
    return sentence
  }

  if (referral.referralType === 'RefFrom') {
    const parts = [`Referred to this office by ${who}`]
    if (date) parts.push(`on ${date}`)
    return `${parts.join(' ')}.`
  }

  const parts = [`Referral: ${who}`]
  if (date) parts.push(`on ${date}`)
  return `${parts.join(' ')}.`
}

export function toVoiceEhrReferral(referral: {
  referralType: OpenDentalReferralType
  status?: string | null
  referralDate?: Date | string | null
  specialistName?: string | null
  specialistSpecialty?: string | null
  specialistPhone?: string | null
  note?: string | null
}): VoiceEhrReferral {
  const direction =
    referral.referralType === 'RefTo'
      ? 'outgoing'
      : referral.referralType === 'RefFrom'
        ? 'incoming'
        : 'other'
  const date =
    referral.referralDate instanceof Date
      ? formatDateOnly(referral.referralDate, 'yyyy-MM-dd')
      : formatDateOnly(referral.referralDate ?? null, 'yyyy-MM-dd') || null

  return {
    referral_type: referral.referralType,
    direction,
    status: referral.status ?? null,
    date,
    specialist_name: referral.specialistName ?? null,
    specialty: referral.specialistSpecialty ?? null,
    phone: referral.specialistPhone ?? null,
    note: referral.note ?? null,
    speakable_summary: formatEhrReferralSpeakable(referral),
  }
}

export function groupVoiceEhrReferrals(referrals: VoiceEhrReferral[]) {
  const outgoing = referrals.filter((r) => r.direction === 'outgoing')
  const incoming = referrals.filter((r) => r.direction === 'incoming')
  const other = referrals.filter((r) => r.direction === 'other')
  return {
    outgoing,
    incoming,
    other,
    speakable_summaries: [...outgoing, ...incoming, ...other].map((r) => r.speakable_summary),
  }
}

async function fetchRefAttaches(practiceId: string, patNum: number): Promise<OpenDentalRefAttach[]> {
  const services = await getOpenDentalServices(practiceId)
  const result = await services.refAttaches.list({ PatNum: patNum })
  if (Array.isArray(result)) return result as OpenDentalRefAttach[]
  if (result && typeof result === 'object') return [result as OpenDentalRefAttach]
  return []
}

async function enrichReferrals(
  practiceId: string,
  attaches: OpenDentalRefAttach[]
): Promise<Map<number, OpenDentalReferral>> {
  const referralNums = [
    ...new Set(
      attaches
        .map((row) => asNumber(row.ReferralNum))
        .filter((n): n is number => n != null && n > 0)
    ),
  ]
  const byReferral = new Map<number, OpenDentalReferral>()
  if (referralNums.length === 0) return byReferral

  try {
    const services = await getOpenDentalServices(practiceId)
    await Promise.all(
      referralNums.map(async (referralNum) => {
        try {
          const referral = (await services.referrals.get(referralNum)) as OpenDentalReferral | null
          if (referral) byReferral.set(referralNum, referral)
        } catch {
          // Directory enrich is best-effort; RefAttaches already has referralName.
        }
      })
    )
  } catch {
    // Connection/services failure should not block attach sync.
  }

  return byReferral
}

export async function syncOpenDentalReferralsForPatient(params: {
  practiceId: string
  patientId: string
  externalEhrId?: string | null
  actorUserId?: string
}): Promise<SyncOpenDentalReferralsResult> {
  const { practiceId, patientId, actorUserId } = params

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId, deletedAt: null },
    select: { id: true, externalEhrId: true },
  })
  if (!patient) {
    return { status: 'skipped', reason: 'patient_not_found' }
  }

  const externalEhrId = params.externalEhrId ?? patient.externalEhrId
  const patNum = extractPatNumFromExternalId(externalEhrId)
  if (patNum == null) {
    return { status: 'skipped', reason: 'patient_not_linked_to_opendental' }
  }

  const connection = await getOpenDentalConnection(practiceId)
  if (!connection?.isActive) {
    return { status: 'skipped', reason: 'opendental_not_configured' }
  }

  let attaches: OpenDentalRefAttach[]
  try {
    attaches = await fetchRefAttaches(practiceId, patNum)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'opendental_referral_fetch_failed'
    return { status: 'error', message }
  }

  const directory = await enrichReferrals(practiceId, attaches)
  const mapped = attaches
    .map((attach) => {
      const referralNum = asNumber(attach.ReferralNum)
      return mapOpenDentalRefAttach(
        attach,
        referralNum != null ? directory.get(referralNum) ?? null : null
      )
    })
    .filter((row): row is MappedEhrReferral => row != null)

  const pulledAt = new Date()
  let created = 0
  let updated = 0
  let pruned = 0

  await prisma.$transaction(async (tx) => {
    const existing = await tx.patientEhrReferral.findMany({
      where: { patientId, practiceId, source: EHR_REFERRAL_SOURCE_OPENDENTAL },
    })
    const byAttachId = new Map(existing.map((row) => [row.externalAttachId, row]))
    const liveIds = new Set(mapped.map((row) => row.externalAttachId))

    for (const referral of mapped) {
      const data = {
        practiceId,
        patientId,
        source: EHR_REFERRAL_SOURCE_OPENDENTAL,
        externalAttachId: referral.externalAttachId,
        externalReferralId: referral.externalReferralId,
        referralType: referral.referralType,
        status: referral.status,
        referralDate: referral.referralDate,
        note: referral.note,
        specialistName: referral.specialistName,
        specialistSpecialty: referral.specialistSpecialty,
        specialistPhone: referral.specialistPhone,
        specialistTitle: referral.specialistTitle,
        isDoctor: referral.isDoctor,
        referringProvNum: referral.referringProvNum,
        procNum: referral.procNum,
        lastPulledAt: pulledAt,
      }
      const match = byAttachId.get(referral.externalAttachId)
      if (match) {
        await tx.patientEhrReferral.update({
          where: { id: match.id },
          data,
        })
        updated += 1
      } else {
        await tx.patientEhrReferral.create({ data })
        created += 1
      }
    }

    const staleIds = existing
      .filter((row) => !liveIds.has(row.externalAttachId))
      .map((row) => row.id)
    if (staleIds.length > 0) {
      const deleted = await tx.patientEhrReferral.deleteMany({
        where: { id: { in: staleIds }, patientId, practiceId },
      })
      pruned = deleted.count
    }
  })

  if (created > 0 || pruned > 0) {
    const outgoing = mapped.filter((row) => row.referralType === 'RefTo')
    const headline = outgoing[0]?.specialistName
      ? `Latest outgoing referral: ${outgoing[0].specialistName}`
      : mapped.length === 0
        ? 'No Open Dental referrals on file'
        : `${mapped.length} referral${mapped.length === 1 ? '' : 's'} synced from Open Dental`
    await createTimelineEntry({
      patientId,
      type: 'other',
      title: 'Referrals synced from Open Dental',
      description: headline,
      metadata: {
        source: EHR_REFERRAL_SOURCE_OPENDENTAL,
        fetched: mapped.length,
        created,
        updated,
        pruned,
        actorUserId: actorUserId || null,
        patNum,
      },
    })
  }

  return {
    status: 'success',
    fetched: mapped.length,
    created,
    updated,
    pruned,
    referrals: mapped,
  }
}

export async function loadStoredEhrReferralsForVoice(params: {
  practiceId: string
  patientId: string
}): Promise<VoiceEhrReferral[]> {
  const rows = await prisma.patientEhrReferral.findMany({
    where: {
      practiceId: params.practiceId,
      patientId: params.patientId,
      source: EHR_REFERRAL_SOURCE_OPENDENTAL,
    },
    orderBy: [{ referralDate: 'desc' }, { updatedAt: 'desc' }],
  })

  return rows.map((row) =>
    toVoiceEhrReferral({
      referralType: normalizeOpenDentalReferralType(row.referralType),
      status: row.status,
      referralDate: row.referralDate,
      specialistName: row.specialistName,
      specialistSpecialty: row.specialistSpecialty,
      specialistPhone: row.specialistPhone,
      note: row.note,
    })
  )
}

export async function getLiveEhrReferralsForVoice(params: {
  practiceId: string
  patientId: string
  externalEhrId?: string | null
}): Promise<{
  referrals: VoiceEhrReferral[]
  grouped: ReturnType<typeof groupVoiceEhrReferrals>
  refreshedFromOpenDental: boolean
  summary: { fetched: number; created: number; updated: number; pruned: number } | null
  error: string | null
  reason: string | null
}> {
  const sync = await syncOpenDentalReferralsForPatient(params)
  if (sync.status === 'error') {
    const stored = await loadStoredEhrReferralsForVoice(params)
    return {
      referrals: stored,
      grouped: groupVoiceEhrReferrals(stored),
      refreshedFromOpenDental: false,
      summary: null,
      error: sync.message,
      reason: null,
    }
  }
  if (sync.status === 'skipped') {
    const stored = await loadStoredEhrReferralsForVoice(params)
    return {
      referrals: stored,
      grouped: groupVoiceEhrReferrals(stored),
      refreshedFromOpenDental: false,
      summary: null,
      error: null,
      reason: sync.reason,
    }
  }

  const referrals = sync.referrals
    .map((row) => toVoiceEhrReferral(row))
    .sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date)
      if (a.date) return -1
      if (b.date) return 1
      return 0
    })

  return {
    referrals,
    grouped: groupVoiceEhrReferrals(referrals),
    refreshedFromOpenDental: true,
    summary: {
      fetched: sync.fetched,
      created: sync.created,
      updated: sync.updated,
      pruned: sync.pruned,
    },
    error: null,
    reason: null,
  }
}
