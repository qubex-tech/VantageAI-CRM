import { GoogleGenAI, Type } from '@google/genai'
import type { ProspectResearch } from '../src/lib/types.js'

const RESEARCH_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const STRUCTURE_MODEL = process.env.GEMINI_STRUCTURE_MODEL ?? 'gemini-2.5-flash'

function client() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
}

const RESEARCH_PROMPT = (name: string) => `You are a B2B sales researcher preparing a workforce-onboarding business case
for the prospect: "${name}".

The product being sold is **LP Frontline** — a digital onboarding & allergen-compliance
platform for high-turnover frontline workforces (food retail, hospitality, grocery,
QSR, leisure). The customer's pain is the cost of onboarding new hires before they
serve a single customer, and compliance risk from untrained staff.

Use Google Search to find concrete, current public information about ${name}:

1. **Workforce facts** — total employees, frontline / store-based workers if different,
   number of sites/stores, recent hiring announcements, publicly stated annual
   employee turnover (or use the industry benchmark if no number is published).
2. **Industry & geography** — primary country/region of operation, sector (e.g.
   bakery, coffee, grocery, QSR, hospitality), and the local food-safety /
   allergen-labelling regulation that applies (e.g. Natasha's Law UK 2021, FDA
   FALCPA US, EU FIC 1169/2011, Allergen Bureau AU/NZ).
3. **Strategic priorities** — anything they've publicly said about growth, store
   openings, labour costs, ESG, customer experience, food safety.
4. **3-5 recent news items** in the last ~18 months with title, 1-line summary,
   and approximate date (month + year).

Then produce a punchy magazine-style narrative aimed at their COO / People Director
that mirrors this tone:
- HEADLINE: 6-10 words, declarative, in the format "Before a Single X is Sold." or
  similar (X = their unit of value: sausage roll, latte, basket, room night, etc.).
- SUBHEAD: one sentence quantifying the cadence ("Every 2.4 days, X opens a new
  store. Every day, Y new people need allergen compliance before their first shift.")
- HIDDEN_TIME_COST: one sentence framing onboarding hours as time consumed before
  a customer is served.
- MANAGER_BURDEN: one sentence framing manager oversight as a cost not spent
  running the store.
- CLOSING_LINE: one italic-worthy line equating the lost hours to years of
  continuous working time, ending with their unit of value.
- COMPLIANCE_KICKER: 2 sentences naming the specific regulation and converting
  "thousands of untrained new hires" into a statistical compliance certainty.
- 4 STRATEGIC_OUTCOMES — one each across: Frontline speed-to-productivity,
  Manager capacity, Compliance & food safety, Customer experience / brand. Each
  is a short title + 2-sentence body, written in the prospect's voice.

Be specific and numeric where possible. If a number is unknown, give a defensible
estimate based on industry benchmarks and say "(industry benchmark)".

Return ONLY a plain markdown brief — no JSON yet. End with a "## Sources" section
listing the URLs you relied on.`

const STRUCTURE_PROMPT = (name: string, brief: string) => `You will convert the following research brief about "${name}" into a strict JSON
object matching the provided schema. Do not invent figures the brief doesn't
support — if a number isn't in the brief, leave the field undefined.

For \`suggestedInputs\`, set the ROI calculator defaults that fit this company's
country and sector:
- \`totalFrontlineWorkers\`, \`storeCount\`: from the brief
- \`annualTurnoverPct\`: 0..1 (e.g. 0.75 for 75%)
- \`onboardingHoursWithout\`: 6 (UK food retail) / 8 (US QSR) / 5 (grocery) — pick
- \`onboardingHoursWith\`: half of the without figure (50% LP reduction)
- \`managerHoursWithout\`: 2
- \`managerHoursWith\`: 0.5
- \`frontlineHourlyRate\`: country-appropriate (UK £11.44, US $15, EU €13)
- \`managerHourlyRate\`: 1.25–1.4× frontline rate
- \`currency\`: "£", "$", or "€"
- \`fteHoursPerYear\`: 1820

Brief:
"""
${brief}
"""`

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    company: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        legalName: { type: Type.STRING },
        industry: { type: Type.STRING },
        sector: { type: Type.STRING },
        headquarters: { type: Type.STRING },
        country: { type: Type.STRING },
        website: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ['name'],
    },
    workforce: {
      type: Type.OBJECT,
      properties: {
        totalEmployees: { type: Type.NUMBER },
        frontlineWorkers: { type: Type.NUMBER },
        storeCount: { type: Type.NUMBER },
        annualTurnoverPct: { type: Type.NUMBER },
        notes: { type: Type.STRING },
      },
    },
    compliance: {
      type: Type.OBJECT,
      properties: {
        primaryRegulation: { type: Type.STRING },
        rationale: { type: Type.STRING },
        risk: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
      },
    },
    strategicPriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
    recentNews: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          date: { type: Type.STRING },
        },
        required: ['title', 'summary'],
      },
    },
    suggestedInputs: {
      type: Type.OBJECT,
      properties: {
        totalFrontlineWorkers: { type: Type.NUMBER },
        storeCount: { type: Type.NUMBER },
        annualTurnoverPct: { type: Type.NUMBER },
        onboardingHoursWithout: { type: Type.NUMBER },
        onboardingHoursWith: { type: Type.NUMBER },
        managerHoursWithout: { type: Type.NUMBER },
        managerHoursWith: { type: Type.NUMBER },
        frontlineHourlyRate: { type: Type.NUMBER },
        managerHourlyRate: { type: Type.NUMBER },
        currency: { type: Type.STRING, enum: ['£', '$', '€'] },
        fteHoursPerYear: { type: Type.NUMBER },
      },
    },
    narrative: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        subhead: { type: Type.STRING },
        hiddenTimeCost: { type: Type.STRING },
        managerBurden: { type: Type.STRING },
        closingLine: { type: Type.STRING },
        complianceKicker: { type: Type.STRING },
        strategicOutcomes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              body: { type: Type.STRING },
            },
            required: ['title', 'body'],
          },
        },
      },
      required: [
        'headline',
        'subhead',
        'hiddenTimeCost',
        'managerBurden',
        'closingLine',
        'complianceKicker',
        'strategicOutcomes',
      ],
    },
  },
  required: ['company', 'workforce', 'compliance', 'suggestedInputs', 'narrative'],
} as const

export async function researchProspect(name: string): Promise<ProspectResearch> {
  const ai = client()

  // ---- Pass 1: open-ended grounded research ---------------------------------
  const grounded = await ai.models.generateContent({
    model: RESEARCH_MODEL,
    contents: RESEARCH_PROMPT(name),
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.4,
    },
  })

  const brief = (grounded.text ?? '').trim()
  if (!brief) {
    throw new Error('Gemini returned an empty research brief')
  }

  const sources = extractSources(grounded)

  // ---- Pass 2: structure into our schema (no search tool this time) ---------
  const structured = await ai.models.generateContent({
    model: STRUCTURE_MODEL,
    contents: STRUCTURE_PROMPT(name, brief),
    config: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema as any,
      temperature: 0.1,
    },
  })

  const jsonText = (structured.text ?? '').trim()
  let parsed: ProspectResearch
  try {
    parsed = JSON.parse(jsonText) as ProspectResearch
  } catch (e) {
    throw new Error(
      `Failed to parse structured output. First 200 chars: ${jsonText.slice(0, 200)}`,
    )
  }

  if (!parsed.company) parsed.company = { name }
  if (!parsed.company.name) parsed.company.name = name
  parsed.sources = sources

  return parsed
}

// Pull grounding URLs from the response metadata if present.
function extractSources(
  resp: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>,
): Array<{ title: string; uri: string }> {
  const out: Array<{ title: string; uri: string }> = []
  const candidates = (resp as any)?.candidates ?? []
  for (const cand of candidates) {
    const meta = cand?.groundingMetadata
    const chunks = meta?.groundingChunks ?? []
    for (const ch of chunks) {
      const web = ch?.web
      if (web?.uri) {
        out.push({ title: web.title ?? web.uri, uri: web.uri })
      }
    }
  }
  // Dedupe by URI
  const seen = new Set<string>()
  return out.filter((s) => {
    if (seen.has(s.uri)) return false
    seen.add(s.uri)
    return true
  })
}
