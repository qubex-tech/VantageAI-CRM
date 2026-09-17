/**
 * Open Dental "Confirmed" is a Definition (Category=2) on the appointment —
 * separate from AptStatus (Scheduled/Complete/Broken). Practices customize the
 * labels (eConfirmSent, Arrived, In Treatment Room, etc.).
 */

export function extractOpenDentalConfirmed(od: {
  Confirmed?: unknown
  confirmed?: unknown
}): { defNum: number | null; label: string | null } {
  const rawNum = od.Confirmed
  const defNum =
    typeof rawNum === 'number' && Number.isInteger(rawNum) && rawNum > 0
      ? rawNum
      : typeof rawNum === 'string' && /^\d+$/.test(rawNum.trim())
        ? Number(rawNum.trim())
        : null

  const label =
    typeof od.confirmed === 'string' && od.confirmed.trim().length > 0
      ? od.confirmed.trim()
      : null

  return { defNum, label }
}

/** Tailwind classes for a compact OD confirmation chip. */
export function getOdConfirmationChipClasses(label: string | null | undefined): string {
  const key = (label || '').trim().toLowerCase()
  if (!key) return 'bg-gray-100 text-gray-700 border-gray-200'

  if (key === 'confirmed' || key === 'econfirmed' || key === 'texted') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  }
  if (
    key === 'arrived' ||
    key === 'in treatment room' ||
    key === 'ready to go back' ||
    key === 'out the door'
  ) {
    return 'bg-sky-100 text-sky-800 border-sky-200'
  }
  if (
    key === 'econfirmsent' ||
    key === 'e-mailed confirmation' ||
    key.includes('left msg') ||
    key === 'not home' ||
    key === 'line busy'
  ) {
    return 'bg-amber-100 text-amber-900 border-amber-200'
  }
  if (
    key.includes('fail') ||
    key === 'wrong number' ||
    key === 'disconnected number' ||
    key === 'not accepted'
  ) {
    return 'bg-rose-100 text-rose-800 border-rose-200'
  }
  if (key === 'appointment completed') {
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }
  if (key === 'unconfirmed' || key === 'created from web sched') {
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  return 'bg-violet-50 text-violet-800 border-violet-200'
}
