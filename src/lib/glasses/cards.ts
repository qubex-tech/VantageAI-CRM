import { DEFAULT_PRACTICE_TIMEZONE } from '@/lib/timezone'
import {
  GLASSES_LINE_WIDTH,
  type GlassesCard,
  type GlassesChartInput,
  type GlassesNote,
  type GlassesSnippet,
} from '@/lib/glasses/types'

const ANTICOAGULANT =
  /\b(warfarin|coumadin|eliquis|apixaban|xarelto|rivaroxaban|pradaxa|dabigatran|heparin|lovenox|enoxaparin|savaysa|edoxaban)\b/i
const FALL_RISK = /\bfall risk\b/i

type AlertKind = 'allergy' | 'anticoagulant' | 'fall'
type Alert = { kind: AlertKind; line: string }

const STATUS_WORD: Record<AlertKind, string> = {
  allergy: 'ALLERGY',
  anticoagulant: 'ANTICOAGULANT',
  fall: 'FALL RISK',
}

export function clipGlassesLine(value: string, width = GLASSES_LINE_WIDTH): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= width) return text
  return `${text.slice(0, width - 1).trimEnd()}…`
}

function padLines(lines: string[]): [string, string, string] {
  return [lines[0] ?? '', lines[1] ?? '', lines[2] ?? '']
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function ageInYears(dob: Date, now: Date): number | null {
  const age = now.getUTCFullYear() - dob.getUTCFullYear()
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth()
  const years =
    monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate()) ? age - 1 : age
  if (years < 0 || years > 130) return null
  return years
}

function whenLabel(start: Date, now: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const sameDay = day.format(start) === day.format(now)
  const formatted = sameDay
    ? new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(start)
    : new Intl.DateTimeFormat('en-US', {
        timeZone,
        month: 'short',
        day: 'numeric',
      }).format(start)
  return formatted.replace(/[\u202f\u00a0]/g, ' ')
}

function pushAlert(alerts: Alert[], alert: Alert) {
  const key = alert.line.toLowerCase()
  if (alerts.some((item) => item.line.toLowerCase() === key)) return
  alerts.push(alert)
}

function alertsFromText(alerts: Alert[], text: string, type?: string) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return
  const kind = (type ?? '').toLowerCase()
  const negatedAllergy = /\b(no known allergies|nkda|no allergies)\b/i.test(trimmed)
  if (!negatedAllergy && (kind === 'allergy' || kind.includes('allergy') || /\ballerg(y|ic)\b/i.test(trimmed))) {
    const line = /^allerg/i.test(trimmed) ? trimmed : `Allergy: ${trimmed}`
    pushAlert(alerts, { kind: 'allergy', line: clipGlassesLine(line) })
  }
  if (ANTICOAGULANT.test(trimmed)) {
    pushAlert(alerts, { kind: 'anticoagulant', line: clipGlassesLine(`Med: ${trimmed}`) })
  }
  if (FALL_RISK.test(trimmed)) {
    pushAlert(alerts, { kind: 'fall', line: 'Fall risk' })
  }
}

function collectAlerts(input: GlassesChartInput): Alert[] {
  const alerts: Alert[] = []
  for (const note of input.notes ?? []) {
    alertsFromText(alerts, note.content, note.type)
  }
  for (const tag of input.tags ?? []) {
    alertsFromText(alerts, tag)
  }
  for (const snippet of input.snippets ?? []) {
    alertsFromText(alerts, snippet.text, snippet.label)
  }
  const rank: Record<AlertKind, number> = { allergy: 0, anticoagulant: 1, fall: 2 }
  return alerts.sort((a, b) => rank[a.kind] - rank[b.kind])
}

function narrativeNote(notes: GlassesNote[]): GlassesNote | null {
  const narrative = notes.filter((note) => {
    const type = note.type.toLowerCase()
    return type !== 'allergy' && type !== 'medication' && type !== 'med'
  })
  return narrative[0] ?? null
}

function wrapLines(text: string): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = ''
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]
    const next = current ? `${current} ${word}` : word
    if (next.length > GLASSES_LINE_WIDTH && current) {
      lines.push(current)
      if (lines.length === 2) {
        lines.push(clipGlassesLine(words.slice(i).join(' ')))
        return lines
      }
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(clipGlassesLine(current))
  return lines.slice(0, 3)
}

export function projectGlassesCards(input: GlassesChartInput): GlassesCard[] {
  const now = input.now ?? new Date()
  const dob = asDate(input.dateOfBirth)
  const age = dob ? ageInYears(dob, now) : null
  const alerts = collectAlerts(input)
  const status = alerts[0] ? STATUS_WORD[alerts[0].kind] : ''
  const start = asDate(input.appointmentStart)
  const timeZone = input.timeZone?.trim() || DEFAULT_PRACTICE_TIMEZONE
  const when = start ? whenLabel(start, now, timeZone) : ''
  const detail = input.reason?.trim() || input.visitType?.trim() || 'Visit'
  const visitLine = when ? `${when} · ${detail}` : detail

  const glance: GlassesCard = {
    id: 'glance',
    title: 'Glance',
    lines: padLines([
      clipGlassesLine(age != null ? `${input.patientName.trim().toUpperCase()} · ${age}` : input.patientName.trim().toUpperCase()),
      clipGlassesLine(visitLine),
      status,
    ]),
  }

  const alertsCard: GlassesCard = {
    id: 'alerts',
    title: 'Alerts',
    lines: padLines(
      alerts.length > 0 ? alerts.slice(0, 3).map((alert) => alert.line) : ['No alerts on the chart']
    ),
  }

  const note = narrativeNote(input.notes ?? [])
  const snippet = (input.snippets ?? []).find((item) => /recent note|pre-visit|last visit/i.test(item.label))
  const story = note?.content || snippet?.text || ''
  const lastVisit: GlassesCard = {
    id: 'lastVisit',
    title: 'Last visit',
    lines: padLines(story ? wrapLines(story) : ['No prior visit on the chart']),
  }

  return [glance, alertsCard, lastVisit]
}

export function snippetsForAsk(input: GlassesChartInput, cards: GlassesCard[]): GlassesSnippet[] {
  const fromChart: GlassesSnippet[] = [
    ...(input.snippets ?? []),
    ...(input.notes ?? []).map((note) => ({ label: note.type, text: note.content })),
  ]
  const fromCards: GlassesSnippet[] = cards.flatMap((card) =>
    card.lines.filter(Boolean).map((text) => ({ label: card.title, text }))
  )
  return [...fromChart, ...fromCards]
}
