import { GoogleGenAI, Type } from '@google/genai'
import Exa from 'exa-js'
import type { PlayMaker } from '../src/lib/types.js'

const RESEARCH_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const STRUCTURE_MODEL = process.env.GEMINI_STRUCTURE_MODEL ?? 'gemini-2.5-flash'

function gemini() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
}

function exa() {
  const key = process.env.EXA_API_KEY
  if (!key) return null
  return new Exa(key)
}

// ----------------------------------------------------------------------------

interface ExaHit {
  title: string
  url: string
  publishedDate?: string
  text?: string
  summary?: string
}

async function exaPersonSearch(name: string, company?: string): Promise<ExaHit[]> {
  const client = exa()
  if (!client) return []

  const queries: string[] = []
  if (company) {
    queries.push(`${name} ${company} executive profile interview`)
    queries.push(`${name} ${company} LinkedIn`)
  } else {
    queries.push(`${name} executive profile interview`)
    queries.push(`${name} LinkedIn profile`)
  }

  const results: ExaHit[] = []
  for (const q of queries) {
    try {
      const res: any = await client.searchAndContents(q, {
        numResults: 6,
        type: 'auto',
        text: { maxCharacters: 1500 } as any,
        summary: true as any,
      })
      const items = (res?.results ?? []) as any[]
      for (const it of items) {
        results.push({
          title: it.title ?? '',
          url: it.url ?? '',
          publishedDate: it.publishedDate,
          text: typeof it.text === 'string' ? it.text : undefined,
          summary: typeof it.summary === 'string' ? it.summary : undefined,
        })
      }
    } catch (err) {
      console.error('[exa]', q, err instanceof Error ? err.message : err)
    }
  }

  // Dedupe by URL
  const seen = new Set<string>()
  return results.filter((r) => {
    if (!r.url || seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}

function exaEvidenceBlock(hits: ExaHit[]): string {
  if (hits.length === 0) return '(no Exa evidence available)'
  return hits
    .slice(0, 10)
    .map((h, i) => {
      const body = (h.summary || h.text || '').slice(0, 800)
      return `[${i + 1}] ${h.title}\n${h.url}${h.publishedDate ? ` (${h.publishedDate})` : ''}\n${body}`
    })
    .join('\n\n')
}

// ----------------------------------------------------------------------------

const playMakerSchema = {
  type: Type.OBJECT,
  properties: {
    fullName: { type: Type.STRING },
    title: { type: Type.STRING },
    company: { type: Type.STRING },
    tenure: { type: Type.STRING },
    location: { type: Type.STRING },
    linkedinUrl: { type: Type.STRING },
    bio: { type: Type.STRING },
    background: { type: Type.STRING },
    previousRoles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          org: { type: Type.STRING },
          period: { type: Type.STRING },
        },
        required: ['role', 'org'],
      },
    },
    education: { type: Type.ARRAY, items: { type: Type.STRING } },
    responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
    priorities: { type: Type.ARRAY, items: { type: Type.STRING } },
    publicQuotes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          quote: { type: Type.STRING },
          context: { type: Type.STRING },
          date: { type: Type.STRING },
          url: { type: Type.STRING },
        },
        required: ['quote'],
      },
    },
    recentActivity: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          date: { type: Type.STRING },
          url: { type: Type.STRING },
        },
        required: ['title', 'summary'],
      },
    },
    talkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    conversationStarters: { type: Type.ARRAY, items: { type: Type.STRING } },
    potentialObjections: { type: Type.ARRAY, items: { type: Type.STRING } },
    commonGround: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
    identityNotes: { type: Type.STRING },
  },
  required: ['confidence'],
} as const

const RESEARCH_PROMPT = (name: string, company: string | undefined, exaBlock: string) => `You are preparing a sales stakeholder for a meeting with **${name}**${
  company ? ` at ${company}` : ''
}.

The product being sold is **LP Frontline**, a workforce-onboarding and allergen
compliance platform for high-turnover frontline workforces.

You have two sources to combine:

1. Use Google Search (via your built-in tool) to verify identity and pull
   current public information.
2. Independent Exa.ai web evidence (provided below) — short summaries from
   articles, interviews, press releases, LinkedIn-adjacent pages.

EXA EVIDENCE
============
${exaBlock}

Produce a meeting-prep dossier focused on what helps the salesperson connect
and sell:

- Identity verification (full name, current title, employer${company ? ` — likely "${company}"` : ''}, tenure, location, LinkedIn URL if found)
- Background and career arc (2-3 sentence bio + previous roles)
- What they likely own in their current role — responsibilities & decision rights
- Their stated or visible priorities (cost, growth, ESG, compliance, customer experience, retention, etc.)
- Public quotes — anything they've actually said in interviews / earnings calls / podcasts
- Recent activity in the last ~12 months (announcements, talks, posts)
- 3-5 concrete TALKING POINTS that connect LP Frontline's value (onboarding speed, manager capacity, compliance) to **their** known priorities
- 2-3 CONVERSATION STARTERS — warm openers that show you've done your homework
- 2-3 LIKELY OBJECTIONS this person specifically might raise
- 2-3 COMMON GROUND items (shared geography, alumni, previous employer, side interest)

**Identity confidence**: rate "high" only if you're sure this is the right
person (matched by company + role); "medium" if the name + general fit
matches; "low" if multiple people share the name and you can't disambiguate.
Include identityNotes explaining how you disambiguated.

Return ONLY a plain markdown briefing — no JSON yet. End with "## Sources"
listing the URLs you used.`

const STRUCTURE_PROMPT = (name: string, brief: string) => `Convert the following meeting-prep briefing about "${name}" into JSON matching
the provided schema. Do not invent facts the briefing doesn't support — if a
field isn't present, leave it undefined.

Briefing:
"""
${brief}
"""`

// ----------------------------------------------------------------------------

export async function researchPlayMaker(
  name: string,
  company?: string,
): Promise<PlayMaker> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Server is missing GEMINI_API_KEY')
  }

  const exaHits = await exaPersonSearch(name, company)
  const evidence = exaEvidenceBlock(exaHits)

  const ai = gemini()

  // Pass 1: grounded research
  const grounded = await ai.models.generateContent({
    model: RESEARCH_MODEL,
    contents: RESEARCH_PROMPT(name, company, evidence),
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.4,
    },
  })

  const brief = (grounded.text ?? '').trim()
  if (!brief) {
    throw new Error(`Gemini returned an empty briefing for "${name}"`)
  }

  // Pass 2: structured extraction
  const structured = await ai.models.generateContent({
    model: STRUCTURE_MODEL,
    contents: STRUCTURE_PROMPT(name, brief),
    config: {
      responseMimeType: 'application/json',
      responseSchema: playMakerSchema as any,
      temperature: 0.1,
    },
  })

  const jsonText = (structured.text ?? '').trim()
  let parsed: Partial<PlayMaker>
  try {
    parsed = JSON.parse(jsonText)
  } catch (e) {
    throw new Error(
      `Failed to parse play-maker JSON for "${name}". First 200 chars: ${jsonText.slice(0, 200)}`,
    )
  }

  const geminiSources = extractGeminiSources(grounded)
  const exaSources = exaHits
    .filter((h) => h.url)
    .map((h) => ({ title: h.title || h.url, uri: h.url }))

  const allSources = dedupeSources([...geminiSources, ...exaSources])

  return {
    id: makeId(),
    inputName: name,
    confidence: 'low',
    ...parsed,
    sources: allSources,
  }
}

export async function researchPlayMakers(
  names: string[],
  company?: string,
): Promise<PlayMaker[]> {
  // Run in parallel, but tolerate individual failures so one bad name doesn't
  // wreck the batch.
  const settled = await Promise.allSettled(
    names.map((n) => researchPlayMaker(n, company)),
  )
  return settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      id: makeId(),
      inputName: names[i],
      confidence: 'low' as const,
      identityNotes: `Research failed: ${
        r.reason instanceof Error ? r.reason.message : String(r.reason)
      }`,
    }
  })
}

// ----------------------------------------------------------------------------

function extractGeminiSources(
  resp: any,
): Array<{ title: string; uri: string }> {
  const out: Array<{ title: string; uri: string }> = []
  const candidates = resp?.candidates ?? []
  for (const cand of candidates) {
    const chunks = cand?.groundingMetadata?.groundingChunks ?? []
    for (const ch of chunks) {
      const web = ch?.web
      if (web?.uri) out.push({ title: web.title ?? web.uri, uri: web.uri })
    }
  }
  return out
}

function dedupeSources(arr: Array<{ title: string; uri: string }>) {
  const seen = new Set<string>()
  return arr.filter((s) => {
    if (!s.uri || seen.has(s.uri)) return false
    seen.add(s.uri)
    return true
  })
}

function makeId(): string {
  // Lightweight uuid — no need for crypto.randomUUID compat checks
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
