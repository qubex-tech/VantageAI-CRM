import { getZonedDateParts } from '@/automations/patient-birthday'

export const APPOINTMENT_UPCOMING_EVENT = 'crm/appointment.upcoming'
export const DEFAULT_UPCOMING_DAYS = 2
export const MAX_UPCOMING_DAYS = 30

type AutomationActionLike = {
  type?: unknown
  args?: Record<string, unknown> | null
}

export function clampUpcomingDays(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return null
  const days = Math.floor(n)
  if (days < 0 || days > MAX_UPCOMING_DAYS) return null
  return days
}

export function extractUpcomingDaysBeforeFromConditions(conditionsJson: unknown): number | null {
  if (!conditionsJson || typeof conditionsJson !== 'object') return null
  return clampUpcomingDays((conditionsJson as { upcomingDaysBefore?: unknown }).upcomingDaysBefore)
}

export function extractUpcomingDaysBeforeFromActions(actionsJson: unknown): number[] {
  if (!Array.isArray(actionsJson)) return []

  const days = new Set<number>()
  for (const raw of actionsJson) {
    if (!raw || typeof raw !== 'object') continue
    const action = raw as AutomationActionLike
    if (action.type !== 'run_eligibility') continue
    const args = action.args && typeof action.args === 'object' ? action.args : {}
    const parsed = clampUpcomingDays(args.daysBefore)
    if (parsed != null) days.add(parsed)
  }
  return [...days].sort((a, b) => a - b)
}

function extractConditionWindowDays(conditionsJson: unknown): number | null {
  let maxDays: number | null = null

  const consider = (days: number | null) => {
    if (days == null) return
    maxDays = maxDays == null ? days : Math.max(maxDays, days)
  }

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const rec = node as Record<string, unknown>
    if (rec.field === 'appointment.daysUntilStart') {
      consider(clampUpcomingDays(rec.value))
    }
    if (rec.field === 'appointment.hoursUntilStart') {
      const hours = typeof rec.value === 'number' ? rec.value : Number(rec.value)
      if (Number.isFinite(hours) && hours > 0) {
        consider(clampUpcomingDays(Math.ceil(hours / 24)))
      }
    }
    if (Array.isArray(rec.conditions)) rec.conditions.forEach(walk)
  }

  walk(conditionsJson)
  return maxDays
}

export type UpcomingEmitConfig = {
  /** Calendar days that should emit at least once (explicit days-before settings). */
  targetDays: number[]
  /** How far ahead to query appointments. */
  windowDays: number
  /** Legacy upcoming rules with no days-before: emit once per local day in the window. */
  emitDailyInWindow: boolean
}

export function extractUpcomingEmitConfig(
  rules: Array<{ conditionsJson?: unknown; actionsJson?: unknown }>
): UpcomingEmitConfig {
  const targetDays = new Set<number>()
  let emitDailyInWindow = false
  let windowDays = 0

  for (const rule of rules) {
    const fromConditions = extractUpcomingDaysBeforeFromConditions(rule.conditionsJson)
    const fromActions = extractUpcomingDaysBeforeFromActions(rule.actionsJson)
    const explicit = [
      ...(fromConditions != null ? [fromConditions] : []),
      ...fromActions,
    ]

    if (explicit.length > 0) {
      for (const days of explicit) targetDays.add(days)
      windowDays = Math.max(windowDays, ...explicit)
    } else {
      emitDailyInWindow = true
      windowDays = Math.max(windowDays, DEFAULT_UPCOMING_DAYS)
    }

    const conditionWindow = extractConditionWindowDays(rule.conditionsJson)
    if (conditionWindow != null) {
      windowDays = Math.max(windowDays, conditionWindow)
    }
  }

  if (windowDays <= 0) windowDays = DEFAULT_UPCOMING_DAYS

  return {
    targetDays: [...targetDays].sort((a, b) => a - b),
    windowDays,
    emitDailyInWindow,
  }
}

/**
 * Calendar-date difference in the practice timezone.
 * "3 days before" means the appointment's local date is 3 days after today.
 */
export function calendarDaysUntil(start: Date, now: Date, timeZone: string): number {
  const startParts = getZonedDateParts(start, timeZone)
  const nowParts = getZonedDateParts(now, timeZone)
  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day)
  const nowUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day)
  return Math.round((startUtc - nowUtc) / (24 * 60 * 60 * 1000))
}

export function shouldEmitUpcomingForDaysUntil(
  daysUntil: number,
  config: UpcomingEmitConfig
): boolean {
  if (daysUntil < 0 || daysUntil > config.windowDays) return false
  if (config.targetDays.includes(daysUntil)) return true
  if (config.emitDailyInWindow) return true
  // Appointments booked inside an explicit window still fire once (daysUntil < N).
  return config.targetDays.some((target) => daysUntil < target)
}

/**
 * A rule with upcomingDaysBefore (or run_eligibility.daysBefore) only matches
 * once the appointment is that many calendar days away or closer.
 */
export function ruleMatchesUpcomingWindow(params: {
  triggerEvent?: string | null
  conditionsJson?: unknown
  actionsJson?: unknown
  daysUntilStart?: unknown
}): boolean {
  if (params.triggerEvent && params.triggerEvent !== APPOINTMENT_UPCOMING_EVENT) {
    return true
  }

  const fromConditions = extractUpcomingDaysBeforeFromConditions(params.conditionsJson)
  const fromActions = extractUpcomingDaysBeforeFromActions(params.actionsJson)
  const daysBefore = fromConditions ?? (fromActions.length > 0 ? Math.max(...fromActions) : null)
  if (daysBefore == null) return true

  const daysUntil = clampUpcomingDays(params.daysUntilStart)
  if (daysUntil == null) return true
  return daysUntil <= daysBefore
}

export function upcomingEmitKey(appointmentId: string, daysUntilStart: number): string {
  return `${appointmentId}:${daysUntilStart}`
}
