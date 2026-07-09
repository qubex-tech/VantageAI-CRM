'use client'

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import Link from 'next/link'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const WEEK_STARTS_ON = 0 as const // Sunday-first, like the reference

const HOUR_START = 6
const HOUR_END = 22 // exclusive end hour (show through 9:30pm slot ending 10pm)
const PX_PER_HOUR = 48
const ALL_DAY_HEIGHT = 32
const SNAP_MINUTES = 15
const DEFAULT_BLOCK_MINUTES = 30
const GRID_START_MIN = HOUR_START * 60
const GRID_END_MIN = HOUR_END * 60

type DraftBlockSelection = {
  day: Date
  /** Minutes from midnight */
  startMin: number
  /** Minutes from midnight */
  endMin: number
}

function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
}

function pointerYToGridMinutes(clientY: number, columnTop: number): number {
  const y = clientY - columnTop
  const minutesFromGridStart = (y / PX_PER_HOUR) * 60
  const absolute = GRID_START_MIN + minutesFromGridStart
  return Math.min(
    GRID_END_MIN - SNAP_MINUTES,
    Math.max(GRID_START_MIN, snapMinutes(absolute))
  )
}

function minutesToDateOnDay(day: Date, minutesFromMidnight: number): Date {
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  d.setMinutes(minutesFromMidnight)
  return d
}

interface Appointment {
  id: string
  patient: {
    id: string | null
    name: string
    phone: string | null
    primaryPhone: string | null
  }
  startTime: Date
  endTime: Date | null
  visitType: string | null
  status: string
  reason: string | null
  isCalBooking?: boolean
  providerName?: string | null
}

export type AppointmentsCalendarLayout = 'week' | 'day'

export type CalendarBlockOccurrenceView = {
  blockId: string
  kind: 'block' | 'meeting'
  title: string
  notes: string | null
  startTime: Date | string
  endTime: Date | string
  timezone: string
  providerId: string | null
  isRecurring: boolean
  occurrenceDate: string
  series: {
    recurrenceFrequency: 'none' | 'daily' | 'weekly'
    recurrenceInterval: number
    recurrenceByDay: string[]
    recurrenceUntil: string | null
  }
}

interface AppointmentsCalendarViewProps {
  layout: AppointmentsCalendarLayout
  appointments: Appointment[]
  calendarBlocks?: CalendarBlockOccurrenceView[]
  selectedDate?: Date
  onDateSelect?: (date: Date | null) => void
  onCreateBlock?: (start: Date, end: Date) => void
  onEditBlock?: (block: CalendarBlockOccurrenceView) => void
  onVisibleRangeChange?: (from: Date, to: Date) => void
}

type TimedApt = {
  apt: Appointment
  top: number
  height: number
  startMin: number
  endMin: number
}

function getStatusStyles(status: string): { bg: string; border: string; text: string } {
  switch (status) {
    case 'confirmed':
      return {
        bg: 'bg-emerald-50/95',
        border: 'border-l-emerald-600',
        text: 'text-emerald-950',
      }
    case 'scheduled':
      return {
        bg: 'bg-sky-50/95',
        border: 'border-l-sky-600',
        text: 'text-sky-950',
      }
    case 'completed':
      return {
        bg: 'bg-gray-100/95',
        border: 'border-l-gray-500',
        text: 'text-gray-900',
      }
    case 'cancelled':
      return {
        bg: 'bg-rose-50/95',
        border: 'border-l-rose-500',
        text: 'text-rose-950',
      }
    default:
      return {
        bg: 'bg-gray-100/95',
        border: 'border-l-gray-500',
        text: 'text-gray-900',
      }
  }
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd
}

/** Cluster indices that mutually overlap (transitive), for column layout per cluster. */
function clusterOverlapIndices(items: TimedApt[]): number[][] {
  const n = items.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i])
    return parent[i]
  }
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b)
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (
        intervalsOverlap(items[i].startMin, items[i].endMin, items[j].startMin, items[j].endMin)
      ) {
        union(i, j)
      }
    }
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(i)
  }
  return Array.from(groups.values())
}

/** Greedy column assignment inside one cluster; returns colIndex and colCount for each apt index. */
function layoutCluster(
  clusterIdxs: number[],
  items: TimedApt[]
): Map<number, { col: number; colCount: number }> {
  const sorted = [...clusterIdxs].sort(
    (i, j) => items[i].startMin - items[j].startMin || items[i].endMin - items[j].endMin
  )
  const lastEndPerCol: number[] = []
  const colByIndex = new Map<number, number>()
  for (const idx of sorted) {
    const ev = items[idx]
    let c = 0
    while (c < lastEndPerCol.length && lastEndPerCol[c] > ev.startMin) {
      c++
    }
    if (c === lastEndPerCol.length) {
      lastEndPerCol.push(ev.endMin)
    } else {
      lastEndPerCol[c] = Math.max(lastEndPerCol[c], ev.endMin)
    }
    colByIndex.set(idx, c)
  }
  const colCount = lastEndPerCol.length
  const out = new Map<number, { col: number; colCount: number }>()
  for (const idx of clusterIdxs) {
    out.set(idx, { col: colByIndex.get(idx) ?? 0, colCount })
  }
  return out
}

type TimedWithLayout = TimedApt & { _col: number; _colCount: number }

function buildTimedForDay(day: Date, appointments: Appointment[]): TimedWithLayout[] {
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const gridStartMin = HOUR_START * 60
  const gridEndMin = HOUR_END * 60

  const timed: TimedApt[] = []

  for (const apt of appointments) {
    const start = new Date(apt.startTime)
    if (!isSameDay(start, day)) continue

    const endRaw = apt.endTime ? new Date(apt.endTime) : new Date(start.getTime() + 30 * 60_000)
    let startMin = start.getHours() * 60 + start.getMinutes()
    let endMin = endRaw.getHours() * 60 + endRaw.getMinutes()
    if (!isSameDay(endRaw, day) && endRaw > dayStart) {
      endMin = 24 * 60
    }
    if (endMin <= startMin) {
      endMin = startMin + 30
    }
    // Skip “all-day style” (midnight, long span) for timed grid — shown in all-day strip if needed
    const isMidnightStart = start.getHours() === 0 && start.getMinutes() === 0
    const spansMostOfDay = endMin - startMin >= 14 * 60
    if (isMidnightStart && spansMostOfDay) {
      continue
    }

    const clippedStart = Math.max(startMin, gridStartMin)
    const clippedEnd = Math.min(endMin, gridEndMin)
    if (clippedEnd <= gridStartMin || clippedStart >= gridEndMin) {
      continue
    }

    const top = ((clippedStart - gridStartMin) / 60) * PX_PER_HOUR
    const height = Math.max(((clippedEnd - clippedStart) / 60) * PX_PER_HOUR, 22)

    timed.push({
      apt,
      top,
      height,
      startMin: clippedStart,
      endMin: clippedEnd,
    })
  }

  const clusters = clusterOverlapIndices(timed)
  const layout = new Map<number, { col: number; colCount: number }>()
  clusters.forEach((clus) => {
    const m = layoutCluster(clus, timed)
    m.forEach((v, k) => layout.set(k, v))
  })

  return timed.map((t, i) => {
    const L = layout.get(i) ?? { col: 0, colCount: 1 }
    return { ...t, _col: L.col, _colCount: L.colCount }
  })
}

function buildAllDayForDay(day: Date, appointments: Appointment[]): Appointment[] {
  const out: Appointment[] = []
  for (const apt of appointments) {
    const start = new Date(apt.startTime)
    if (!isSameDay(start, day)) continue
    const endRaw = apt.endTime ? new Date(apt.endTime) : new Date(start.getTime() + 30 * 60_000)
    let startMin = start.getHours() * 60 + start.getMinutes()
    let endMin = endRaw.getHours() * 60 + endRaw.getMinutes()
    if (!isSameDay(endRaw, day) && endRaw > start) {
      endMin = 24 * 60
    }
    if (endMin <= startMin) endMin = startMin + 30
    const isMidnightStart = start.getHours() === 0 && start.getMinutes() === 0
    const spansMostOfDay = endMin - startMin >= 14 * 60
    if (isMidnightStart && spansMostOfDay) {
      out.push(apt)
    }
  }
  return out
}

function getBlockStyles(kind: string): { bg: string; border: string; text: string } {
  if (kind === 'meeting') {
    return {
      bg: 'bg-violet-50/95',
      border: 'border-l-violet-600',
      text: 'text-violet-950',
    }
  }
  return {
    bg: 'bg-amber-50/95 bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(180,83,9,0.08)_4px,rgba(180,83,9,0.08)_8px)]',
    border: 'border-l-amber-600',
    text: 'text-amber-950',
  }
}

type TimedBlock = {
  block: CalendarBlockOccurrenceView
  top: number
  height: number
}

function buildBlocksForDay(
  day: Date,
  blocks: CalendarBlockOccurrenceView[]
): TimedBlock[] {
  const gridStartMin = HOUR_START * 60
  const gridEndMin = HOUR_END * 60
  const out: TimedBlock[] = []

  for (const block of blocks) {
    const start = new Date(block.startTime)
    if (!isSameDay(start, day)) continue
    const endRaw = new Date(block.endTime)
    let startMin = start.getHours() * 60 + start.getMinutes()
    let endMin = endRaw.getHours() * 60 + endRaw.getMinutes()
    if (!isSameDay(endRaw, day) && endRaw > start) {
      endMin = 24 * 60
    }
    if (endMin <= startMin) endMin = startMin + 30

    const clippedStart = Math.max(startMin, gridStartMin)
    const clippedEnd = Math.min(endMin, gridEndMin)
    if (clippedEnd <= gridStartMin || clippedStart >= gridEndMin) continue

    out.push({
      block,
      top: ((clippedStart - gridStartMin) / 60) * PX_PER_HOUR,
      height: Math.max(((clippedEnd - clippedStart) / 60) * PX_PER_HOUR, 22),
    })
  }
  return out
}

export function AppointmentsCalendarView({
  layout,
  appointments,
  calendarBlocks = [],
  selectedDate,
  onDateSelect,
  onCreateBlock,
  onEditBlock,
  onVisibleRangeChange,
}: AppointmentsCalendarViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [focusDate, setFocusDate] = useState(() => startOfDay(selectedDate || new Date()))
  const [currentMonth, setCurrentMonth] = useState(() => selectedDate || new Date())
  const [draftBlock, setDraftBlock] = useState<DraftBlockSelection | null>(null)
  const draftBlockRef = useRef<DraftBlockSelection | null>(null)
  const dragAnchorMinRef = useRef<number | null>(null)
  const isDraggingBlockRef = useRef(false)

  useEffect(() => {
    if (selectedDate) {
      setFocusDate(startOfDay(selectedDate))
      setCurrentMonth(selectedDate)
    }
  }, [selectedDate])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const targetHour = 8
    const scrollTop = Math.max(0, (targetHour - HOUR_START) * PX_PER_HOUR - 8)
    el.scrollTop = scrollTop
  }, [focusDate, layout])

  const weekStart = startOfWeek(focusDate, { weekStartsOn: WEEK_STARTS_ON })
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: WEEK_STARTS_ON })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const displayDays = layout === 'day' ? [startOfDay(focusDate)] : weekDays

  useEffect(() => {
    if (!onVisibleRangeChange) return
    const from = layout === 'day' ? startOfDay(focusDate) : weekStart
    const to =
      layout === 'day'
        ? addDays(startOfDay(focusDate), 1)
        : addDays(weekEnd, 1)
    onVisibleRangeChange(from, to)
  }, [layout, focusDate, weekStart, weekEnd, onVisibleRangeChange])

  const commitDraftBlock = () => {
    const draft = draftBlockRef.current
    draftBlockRef.current = null
    dragAnchorMinRef.current = null
    isDraggingBlockRef.current = false
    setDraftBlock(null)
    if (!draft || !onCreateBlock) return
    const start = minutesToDateOnDay(draft.day, draft.startMin)
    const end = minutesToDateOnDay(draft.day, draft.endMin)
    if (end <= start) return
    onCreateBlock(start, end)
  }

  const updateDraftFromPointer = (clientY: number, columnTop: number) => {
    const anchor = dragAnchorMinRef.current
    const current = draftBlockRef.current
    if (anchor == null || !current) return

    const pointerMin = pointerYToGridMinutes(clientY, columnTop)
    let startMin = Math.min(anchor, pointerMin)
    let endMin = Math.max(anchor, pointerMin)

    // Click / short drag always yields at least the default 30-minute slot
    if (endMin - startMin < DEFAULT_BLOCK_MINUTES) {
      if (pointerMin >= anchor) {
        startMin = anchor
        endMin = Math.min(GRID_END_MIN, anchor + DEFAULT_BLOCK_MINUTES)
      } else {
        endMin = anchor
        startMin = Math.max(GRID_START_MIN, anchor - DEFAULT_BLOCK_MINUTES)
      }
    }

    const next = { ...current, startMin, endMin }
    draftBlockRef.current = next
    setDraftBlock(next)
  }

  const handleColumnPointerDown = (
    e: ReactPointerEvent<HTMLDivElement>,
    day: Date
  ) => {
    if (!onCreateBlock || e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('a, button')) return

    const rect = e.currentTarget.getBoundingClientRect()
    const startMin = pointerYToGridMinutes(e.clientY, rect.top)
    const endMin = Math.min(GRID_END_MIN, startMin + DEFAULT_BLOCK_MINUTES)
    const draft: DraftBlockSelection = {
      day: startOfDay(day),
      startMin,
      endMin,
    }

    dragAnchorMinRef.current = startMin
    draftBlockRef.current = draft
    isDraggingBlockRef.current = true
    setDraftBlock(draft)

    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const handleColumnPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingBlockRef.current || !draftBlockRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    updateDraftFromPointer(e.clientY, rect.top)
  }

  const handleColumnPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingBlockRef.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    commitDraftBlock()
  }

  const handleColumnPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingBlockRef.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    draftBlockRef.current = null
    dragAnchorMinRef.current = null
    isDraggingBlockRef.current = false
    setDraftBlock(null)
  }

  const hours = useMemo(() => {
    const list: number[] = []
    for (let h = HOUR_START; h < HOUR_END; h++) list.push(h)
    return list
  }, [])

  const gridHeight = (HOUR_END - HOUR_START) * PX_PER_HOUR

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON })
  const miniMonthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const goToToday = () => {
    const now = new Date()
    const day = startOfDay(now)
    setFocusDate(day)
    setCurrentMonth(now)
    onDateSelect?.(null)
  }

  const stepBackward = () => {
    if (layout === 'day') {
      setFocusDate((d) => startOfDay(subDays(d, 1)))
    } else {
      setFocusDate((d) => subWeeks(d, 1))
    }
  }

  const stepForward = () => {
    if (layout === 'day') {
      setFocusDate((d) => startOfDay(addDays(d, 1)))
    } else {
      setFocusDate((d) => addWeeks(d, 1))
    }
  }

  const previousMonthMini = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonthMini = () => setCurrentMonth(addMonths(currentMonth, 1))

  const handleMiniDayClick = (day: Date) => {
    const normalized = startOfDay(day)
    setFocusDate(normalized)
    setCurrentMonth(day)
    if (selectedDate && isSameDay(day, selectedDate)) {
      onDateSelect?.(null)
    } else {
      onDateSelect?.(day)
    }
  }

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const [showMobileMiniCal, setShowMobileMiniCal] = useState(false)

  return (
    <div className="flex flex-col lg:flex-row gap-4 font-sans text-gray-900">
      {/* Mobile date picker button */}
      <div className="lg:hidden flex items-center justify-between mb-2">
        <button
          onClick={() => setShowMobileMiniCal(!showMobileMiniCal)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          {format(focusDate, 'MMM d, yyyy')}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showMobileMiniCal ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToToday} className="text-gray-800 h-9 text-xs">
            Today
          </Button>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none h-9 w-9 px-0"
              onClick={stepBackward}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none h-9 w-9 px-0 border-l border-gray-200"
              onClick={stepForward}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile mini calendar dropdown */}
      {showMobileMiniCal && (
        <div className="lg:hidden mb-4">
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousMonthMini}
                  className="h-8 w-8 p-0"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextMonthMini}
                  className="h-8 w-8 p-0"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDayLabels.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-medium uppercase tracking-wide text-gray-500 py-1"
                  >
                    {d.charAt(0)}
                  </div>
                ))}
                {miniMonthDays.map((day, dayIdx) => {
                  const inMonth = isSameMonth(day, currentMonth)
                  const sel = selectedDate && isSameDay(day, selectedDate)
                  const viewFocus = isSameDay(day, focusDate) && !sel
                  const today = isToday(day)

                  return (
                    <button
                      key={dayIdx}
                      type="button"
                      onClick={() => {
                        handleMiniDayClick(day)
                        setShowMobileMiniCal(false)
                      }}
                      className={[
                        'relative flex h-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
                        !inMonth && 'text-gray-300',
                        inMonth && 'text-gray-800',
                        today && !sel && 'ring-2 ring-blue-500 ring-inset',
                        sel && 'bg-gray-900 text-white',
                        viewFocus && 'bg-gray-200 text-gray-900',
                        !sel && !viewFocus && inMonth && 'hover:bg-gray-100',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sidebar — mini month + legend (desktop only) */}
      <aside className="hidden lg:block w-[272px] flex-shrink-0 space-y-4">
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={previousMonthMini}
                className="h-8 w-8 p-0"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={nextMonthMini}
                className="h-8 w-8 p-0"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {weekDayLabels.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium uppercase tracking-wide text-gray-500 py-1"
                >
                  {d.charAt(0)}
                </div>
              ))}
              {miniMonthDays.map((day, dayIdx) => {
                const inMonth = isSameMonth(day, currentMonth)
                const sel = selectedDate && isSameDay(day, selectedDate)
                const viewFocus = isSameDay(day, focusDate) && !sel
                const today = isToday(day)

                return (
                  <button
                    key={dayIdx}
                    type="button"
                    onClick={() => handleMiniDayClick(day)}
                    className={[
                      'relative flex h-8 items-center justify-center rounded-md text-xs font-medium transition-colors',
                      !inMonth && 'text-gray-300',
                      inMonth && 'text-gray-800',
                      today && !sel && 'ring-2 ring-blue-500 ring-inset',
                      sel && 'bg-gray-900 text-white',
                      viewFocus && 'bg-gray-200 text-gray-900',
                      !sel && !viewFocus && inMonth && 'hover:bg-gray-100',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                <LayoutGrid className="h-3.5 w-3.5 text-gray-500" />
                Status
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-600">
                {(
                  [
                    ['Scheduled', 'bg-sky-400'],
                    ['Confirmed', 'bg-emerald-500'],
                    ['Completed', 'bg-gray-400'],
                    ['Cancelled', 'bg-rose-400'],
                    ['Blocked', 'bg-amber-500'],
                    ['Meeting', 'bg-violet-500'],
                  ] as const
                ).map(([label, dot]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-sm ${dot}`} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Main week grid */}
      <div className="flex-1 min-w-0 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
        {/* Toolbar - Desktop only, mobile has separate controls */}
        <div className="hidden lg:flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50/80">
          <div className="text-base font-semibold text-gray-900">
            {layout === 'day' ? (
              <span>{format(focusDate, 'EEEE, MMMM d, yyyy')}</span>
            ) : (
              <span>
                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} className="text-gray-800">
              Today
            </Button>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none h-9 w-9 px-0"
                onClick={stepBackward}
                aria-label={layout === 'day' ? 'Previous day' : 'Previous week'}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none h-9 w-9 px-0 border-l border-gray-200"
                onClick={stepForward}
                aria-label={layout === 'day' ? 'Next day' : 'Next week'}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile date range indicator */}
        <div className="lg:hidden px-4 py-2 border-b border-gray-200 bg-gray-50/80">
          <div className="text-sm font-medium text-gray-700 text-center">
            {layout === 'day' ? (
              <span>{format(focusDate, 'EEEE, MMM d')}</span>
            ) : (
              <span>
                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* On mobile, week view gets horizontal scroll. Day view is full width */}
          <div className={layout === 'day' ? 'min-w-0 w-full' : 'min-w-[600px] lg:min-w-[720px]'}>
            {/* Day headers + all-day row */}
            <div
              className="grid border-b border-gray-200"
              style={{
                gridTemplateColumns:
                  layout === 'day'
                    ? `56px minmax(0, 1fr)`
                    : `56px repeat(7, minmax(0, 1fr))`,
              }}
            >
              <div className="border-r border-gray-100 bg-gray-50/50" aria-hidden />
              {displayDays.map((day) => {
                const today = isToday(day)
                return (
                  <div
                    key={day.toISOString()}
                    className="py-2 px-1 text-center border-l border-gray-100 bg-white"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      {layout === 'day' ? format(day, 'EEEE') : format(day, 'EEE')}
                    </div>
                    <div
                      className={[
                        'mt-0.5 mx-auto flex h-9 w-9 items-center justify-center text-sm font-semibold',
                        today
                          ? 'rounded-full bg-gray-900 text-white'
                          : 'text-gray-900',
                      ].join(' ')}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              className="grid border-b border-gray-200 bg-gray-50/30"
              style={{
                gridTemplateColumns:
                  layout === 'day'
                    ? `56px minmax(0, 1fr)`
                    : `56px repeat(7, minmax(0, 1fr))`,
                minHeight: ALL_DAY_HEIGHT,
              }}
            >
              <div className="flex items-start justify-end pr-2 pt-1 border-r border-gray-100">
                <span className="text-[10px] font-medium text-gray-400">All-day</span>
              </div>
              {displayDays.map((day) => {
                const allDay = buildAllDayForDay(day, appointments)
                return (
                  <div
                    key={`allday-${day.toISOString()}`}
                    className="border-l border-gray-100 px-0.5 py-0.5 flex flex-col gap-0.5"
                  >
                    {allDay.map((apt) => {
                      const st = getStatusStyles(apt.status)
                      return (
                        <Link key={apt.id} href={`/appointments/${apt.id}`}>
                          <div
                            className={[
                              'truncate rounded px-1.5 py-0.5 text-[11px] font-medium border-l-4 shadow-sm',
                              st.bg,
                              st.border,
                              st.text,
                            ].join(' ')}
                            title={apt.visitType || apt.patient.name}
                          >
                            {apt.patient.name}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Scrollable timed grid */}
            <div
              ref={scrollRef}
              className="overflow-y-auto max-h-[min(70vh,720px)] overscroll-contain"
              style={{ scrollBehavior: 'auto' }}
            >
              <div className="flex">
                {/* Time labels */}
                <div
                  className="w-14 flex-shrink-0 border-r border-gray-100 bg-white text-right pr-2 text-gray-500 select-none"
                  style={{ height: gridHeight }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="text-[11px] leading-none relative"
                      style={{ height: PX_PER_HOUR }}
                    >
                      <span className="absolute -top-2 right-0">
                        {format(new Date(2000, 0, 1, h, 0), 'h a')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                <div
                  className={layout === 'day' ? 'flex-1 grid grid-cols-1 min-w-0' : 'flex-1 grid grid-cols-7 min-w-0'}
                >
                  {displayDays.map((day) => {
                    const timed = buildTimedForDay(day, appointments)
                    const dayBlocks = buildBlocksForDay(day, calendarBlocks)
                    const dayStart = startOfDay(day)
                    const showDraft =
                      draftBlock &&
                      isSameDay(draftBlock.day, dayStart)
                    const draftTop = showDraft
                      ? ((draftBlock.startMin - GRID_START_MIN) / 60) * PX_PER_HOUR
                      : 0
                    const draftHeight = showDraft
                      ? Math.max(
                          ((draftBlock.endMin - draftBlock.startMin) / 60) * PX_PER_HOUR,
                          22
                        )
                      : 0

                    return (
                      <div
                        key={`col-${day.toISOString()}`}
                        className={[
                          'relative border-l border-gray-100 bg-white select-none',
                          onCreateBlock ? 'cursor-crosshair' : '',
                        ].join(' ')}
                        style={{ height: gridHeight }}
                        onPointerDown={(e) => handleColumnPointerDown(e, day)}
                        onPointerMove={handleColumnPointerMove}
                        onPointerUp={handleColumnPointerUp}
                        onPointerCancel={handleColumnPointerCancel}
                      >
                        {/* hour lines */}
                        {hours.map((h) => (
                          <div
                            key={h}
                            className="absolute left-0 right-0 border-b border-gray-100 pointer-events-none"
                            style={{
                              top: (h - HOUR_START) * PX_PER_HOUR,
                              height: PX_PER_HOUR,
                            }}
                          />
                        ))}

                        {showDraft && (
                          <div
                            className="absolute z-[3] left-[2%] w-[96%] px-0.5 pointer-events-none"
                            style={{ top: draftTop, height: draftHeight }}
                          >
                            <div className="h-full w-full overflow-hidden rounded-md border border-amber-400/80 border-l-4 border-l-amber-600 bg-amber-100/90 px-1.5 py-1 shadow-md">
                              <p className="text-[11px] font-semibold leading-tight truncate text-amber-950">
                                Blocked
                              </p>
                              <p className="text-[10px] leading-tight truncate text-amber-950 opacity-90">
                                {format(minutesToDateOnDay(dayStart, draftBlock.startMin), 'h:mm a')}
                                {' – '}
                                {format(minutesToDateOnDay(dayStart, draftBlock.endMin), 'h:mm a')}
                              </p>
                            </div>
                          </div>
                        )}

                        {dayBlocks.map((b, i) => {
                          const st = getBlockStyles(b.block.kind)
                          return (
                            <button
                              key={`${b.block.blockId}-${b.block.occurrenceDate}-${i}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditBlock?.(b.block)
                              }}
                              className="absolute z-[2] block px-0.5 text-left w-[96%] left-[2%] cursor-pointer"
                              style={{ top: b.top, height: b.height }}
                            >
                              <div
                                className={[
                                  'h-full w-full overflow-hidden rounded-md border border-gray-200/60 border-l-4 px-1.5 py-1 shadow-sm',
                                  st.bg,
                                  st.border,
                                ].join(' ')}
                              >
                                <p className={`text-[11px] font-semibold leading-tight truncate ${st.text}`}>
                                  {b.block.title}
                                </p>
                                <p className={`text-[10px] leading-tight truncate opacity-90 ${st.text}`}>
                                  {format(new Date(b.block.startTime), 'h:mm a')}
                                  {' – '}
                                  {format(new Date(b.block.endTime), 'h:mm a')}
                                </p>
                              </div>
                            </button>
                          )
                        })}

                        {timed.map((t, i) => {
                          const { apt, top, height, _col, _colCount } = t
                          const st = getStatusStyles(apt.status)
                          const widthPct = 100 / _colCount
                          const leftPct = _col * widthPct
                          return (
                            <Link
                              key={`${apt.id}-${i}`}
                              href={`/appointments/${apt.id}`}
                              className="absolute z-[1] block px-0.5 group cursor-pointer"
                              style={{
                                top,
                                height,
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                            >
                              <div
                                className={[
                                  'h-full w-full overflow-hidden rounded-md border border-gray-200/60 border-l-4 px-1.5 py-1 shadow-sm transition-shadow',
                                  'group-hover:shadow-md group-hover:border-gray-300',
                                  st.bg,
                                  st.border,
                                ].join(' ')}
                              >
                                <p
                                  className={`text-[11px] font-semibold leading-tight truncate ${st.text}`}
                                >
                                  {apt.patient.name}
                                </p>
                                <p className={`text-[10px] leading-tight truncate opacity-90 ${st.text}`}>
                                  {format(new Date(apt.startTime), 'h:mm a')}
                                  {apt.endTime
                                    ? ` – ${format(new Date(apt.endTime), 'h:mm a')}`
                                    : ''}
                                </p>
                                {apt.visitType && height > 36 && (
                                  <p
                                    className={`text-[10px] mt-0.5 leading-tight line-clamp-2 ${st.text} opacity-80`}
                                  >
                                    {apt.visitType}
                                  </p>
                                )}
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
