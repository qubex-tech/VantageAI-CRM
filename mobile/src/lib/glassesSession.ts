export const GLASSES_DIM_MS = 20_000
export const GLASSES_SLEEP_MS = 25_000
export const GLASSES_ANSWER_MS = 4_000

export type GlassesFrameCard = {
  id: string
  title: string
  lines: readonly string[]
}

export type GlassesFrame = {
  cardId: string
  title: string
  lines: readonly string[]
}

export type GlassesSessionSnapshot = {
  state: 'stopped' | 'starting' | 'started' | 'stopping'
  frame: GlassesFrame | null
  dimmed: boolean
  asleep: boolean
  index: number
  cardCount: number
}

let activeSession: GlassesDisplaySession | null = null

/**
 * Phone-owned display session. Matches the glasses lifecycle: one full frame
 * at a time, dim at 20s, sleep at 25s without ending the session, and stop
 * clears the frame. The glasses themselves do not keep this state.
 */
export class GlassesDisplaySession {
  private state: GlassesSessionSnapshot['state'] = 'stopped'
  private cards: GlassesFrameCard[] = []
  private index = 0
  private frame: GlassesFrame | null = null
  private dimmed = false
  private asleep = false
  private listeners = new Set<() => void>()
  private snapshot: GlassesSessionSnapshot = emptySnapshot()
  private dimTimer: ReturnType<typeof setTimeout> | null = null
  private sleepTimer: ReturnType<typeof setTimeout> | null = null
  private answerTimer: ReturnType<typeof setTimeout> | null = null
  private savedIndex = 0

  getSnapshot = (): GlassesSessionSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  start(cards: GlassesFrameCard[]) {
    if (activeSession && activeSession !== this) activeSession.stop()
    if (this.state === 'started' || this.state === 'starting') this.clearFrame()
    activeSession = this
    this.state = 'starting'
    this.cards = cards.slice(0, 3)
    this.index = 0
    this.state = 'started'
    this.showCurrent()
  }

  nav(direction: 'up' | 'down' | 'left' | 'right') {
    if (this.state !== 'started') return
    if (this.asleep) {
      this.wake()
      return
    }
    if (this.cards.length === 0) return
    const delta = direction === 'left' || direction === 'up' ? -1 : 1
    this.index = (this.index + delta + this.cards.length) % this.cards.length
    this.showCurrent()
  }

  /** Double-tap / select. Wakes a sleeping display, otherwise arms a question. */
  select(): 'wake' | 'ask' {
    if (this.state !== 'started') return 'wake'
    if (this.asleep) {
      this.wake()
      return 'wake'
    }
    return 'ask'
  }

  showAnswer(line: string) {
    if (this.state !== 'started') return
    this.savedIndex = this.index
    this.frame = { cardId: 'answer', title: 'Answer', lines: [line, '', ''] }
    this.armSleep()
    this.emit()
    if (this.answerTimer) clearTimeout(this.answerTimer)
    this.answerTimer = setTimeout(() => {
      this.answerTimer = null
      if (this.state !== 'started') return
      this.index = this.savedIndex
      this.showCurrent()
    }, GLASSES_ANSWER_MS)
  }

  wake() {
    if (this.state !== 'started') return
    this.showCurrent()
  }

  stop() {
    this.clearFrame()
    if (activeSession === this) activeSession = null
  }

  private showCurrent() {
    const card = this.cards[this.index]
    this.frame = card
      ? { cardId: card.id, title: card.title, lines: card.lines }
      : null
    this.armSleep()
    this.emit()
  }

  private armSleep() {
    this.clearSleepTimers()
    this.dimmed = false
    this.asleep = false
    this.dimTimer = setTimeout(() => {
      if (this.state !== 'started') return
      this.dimmed = true
      this.emit()
    }, GLASSES_DIM_MS)
    this.sleepTimer = setTimeout(() => {
      if (this.state !== 'started') return
      this.dimmed = true
      this.asleep = true
      this.emit()
    }, GLASSES_SLEEP_MS)
  }

  private clearFrame() {
    this.clearSleepTimers()
    if (this.answerTimer) clearTimeout(this.answerTimer)
    this.answerTimer = null
    this.state = 'stopping'
    this.frame = null
    this.cards = []
    this.index = 0
    this.dimmed = false
    this.asleep = false
    this.state = 'stopped'
    this.emit()
  }

  private clearSleepTimers() {
    if (this.dimTimer) clearTimeout(this.dimTimer)
    if (this.sleepTimer) clearTimeout(this.sleepTimer)
    this.dimTimer = null
    this.sleepTimer = null
  }

  private emit() {
    this.snapshot = {
      state: this.state,
      frame: this.frame,
      dimmed: this.dimmed,
      asleep: this.asleep,
      index: this.index,
      cardCount: this.cards.length,
    }
    for (const listener of this.listeners) listener()
  }
}

function emptySnapshot(): GlassesSessionSnapshot {
  return {
    state: 'stopped',
    frame: null,
    dimmed: false,
    asleep: false,
    index: 0,
    cardCount: 0,
  }
}
