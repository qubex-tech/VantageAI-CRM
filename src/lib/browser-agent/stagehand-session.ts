/**
 * Stagehand (Browserbase) LLM assist for hybrid Availity RPA.
 * Dynamically imported so Next.js does not bundle Stagehand into the web layer.
 */

import type { z } from 'zod'

export type StagehandAssistHandle = {
  sessionId: string
  act: (instruction: string) => Promise<{ ok: boolean; message?: string }>
  extract: <Schema extends z.ZodType>(
    instruction: string,
    schema: Schema
  ) => Promise<{ ok: boolean; data?: z.output<Schema>; error?: string }>
  close: () => Promise<void>
}

export function isStagehandConfigured(): boolean {
  return Boolean(
    process.env.BROWSERBASE_API_KEY?.trim() &&
      process.env.BROWSERBASE_PROJECT_ID?.trim() &&
      (process.env.OPENAI_API_KEY?.trim() || process.env.BROWSERBASE_API_KEY?.trim())
  )
}

export function isLlmAssistForcedOff(): boolean {
  return process.env.BROWSER_AGENT_LLM === '0' || process.env.BROWSER_AGENT_LLM === 'false'
}

/**
 * Launch a Browserbase session with the Stagehand extension and return act/extract helpers.
 * Playwright should connect to the same sessionId via connectBrowserSession().
 */
export async function createStagehandAssist(params?: {
  practiceId?: string
  playbookId?: string
  model?: string
}): Promise<StagehandAssistHandle> {
  if (!isStagehandConfigured()) {
    throw new Error(
      'Stagehand LLM assist requires BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, and OPENAI_API_KEY'
    )
  }

  const { Stagehand, browserbase } = await import('@browserbasehq/stagehand')

  const apiKey = process.env.BROWSERBASE_API_KEY!
  const projectId = process.env.BROWSERBASE_PROJECT_ID!
  const modelName = (params?.model ||
    process.env.BROWSER_AGENT_LLM_MODEL ||
    'openai/gpt-4.1-mini') as `openai/${string}`

  const browser = await browserbase.launch({
    apiKey,
    projectId,
    browserSettings: {
      viewport: { width: 1440, height: 900 },
    },
    userMetadata: {
      practiceId: params?.practiceId || '',
      playbookId: params?.playbookId || '',
      llmAssist: '1',
    },
  } as Parameters<typeof browserbase.launch>[0])

  const sessionId = browser.sessionId
  if (!sessionId) {
    await browser.close().catch(() => undefined)
    throw new Error('Stagehand Browserbase launch did not return a sessionId')
  }

  const stagehand = await Stagehand.create({
    browser,
    model: {
      modelName,
      apiKey: process.env.OPENAI_API_KEY || apiKey,
    },
    selfHeal: true,
  } as Parameters<typeof Stagehand.create>[0])

  return {
    sessionId,
    act: async (instruction: string) => {
      try {
        const result = await stagehand.act(instruction)
        const message =
          typeof result === 'object' && result && 'message' in result
            ? String((result as { message?: unknown }).message || '')
            : undefined
        return { ok: true, message }
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Stagehand act failed',
        }
      }
    },
    extract: async (instruction, schema) => {
      try {
        // Stagehand ships Zod v4; our app schema is Zod v3 — cast at the boundary.
        const result = (await stagehand.extract(
          instruction,
          schema as unknown as Parameters<typeof stagehand.extract>[1]
        )) as { data?: z.output<typeof schema> } | z.output<typeof schema>
        const data =
          result && typeof result === 'object' && 'data' in result
            ? (result as { data: z.output<typeof schema> }).data
            : (result as z.output<typeof schema>)
        return { ok: true, data }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Stagehand extract failed',
        }
      }
    },
    close: async () => {
      try {
        await stagehand.close()
      } catch {
        // ignore
      }
      try {
        await browser.close()
      } catch {
        // ignore
      }
    },
  }
}
