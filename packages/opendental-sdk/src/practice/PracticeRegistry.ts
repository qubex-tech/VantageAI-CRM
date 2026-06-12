import type { PracticeContext } from './types'

export class PracticeRegistry {
  private readonly contexts = new Map<string, PracticeContext>()

  register(context: PracticeContext): void {
    this.contexts.set(context.practiceId, context)
  }

  unregister(practiceId: string): boolean {
    return this.contexts.delete(practiceId)
  }

  get(practiceId: string): PracticeContext | undefined {
    return this.contexts.get(practiceId)
  }

  require(practiceId: string): PracticeContext {
    const context = this.get(practiceId)
    if (!context) {
      throw new Error(`No Open Dental practice context registered for practiceId: ${practiceId}`)
    }
    return context
  }

  list(): PracticeContext[] {
    return [...this.contexts.values()]
  }

  clear(): void {
    this.contexts.clear()
  }

  has(practiceId: string): boolean {
    return this.contexts.has(practiceId)
  }
}

export const globalPracticeRegistry = new PracticeRegistry()
