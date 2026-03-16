import OpenAI from 'openai'
import type {
  HealixPreChartTemplate,
  PreVisitChartSectionOutput,
  PreVisitChartType,
  PreVisitEvidenceItem,
} from '@/lib/previsit/types'
import { validateAndNumberCitations, type RawGeneratedSection } from '@/lib/previsit/citations'

const MAX_EVIDENCE_ITEMS_FOR_MODEL = 40
const MAX_TITLE_CHARS = 100
const MAX_SNIPPET_CHARS = 220

interface ChartGenerationResult {
  sections: PreVisitChartSectionOutput[]
  references: Array<{
    number: number
    sourceId: string
    source: PreVisitEvidenceItem
  }>
  generationMeta: Record<string, unknown>
}

interface QuestionAnswerResult {
  answer: string
  references: Array<{
    number: number
    sourceId: string
    source: PreVisitEvidenceItem
  }>
}

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

function formatEvidenceForPrompt(evidenceItems: PreVisitEvidenceItem[]) {
  const sourceTypePriority: Record<string, number> = {
    patient_profile: 0,
    patient_note: 1,
    appointment: 2,
    form_submission: 3,
    insurance: 4,
    timeline_entry: 5,
    document_upload: 6,
    knowledge_base: 7,
  }

  const prioritized = [...evidenceItems]
    .sort((a, b) => {
      const aPriority = sourceTypePriority[a.sourceType] ?? 99
      const bPriority = sourceTypePriority[b.sourceType] ?? 99
      if (aPriority !== bPriority) return aPriority - bPriority
      return a.sourceId.localeCompare(b.sourceId)
    })
    .slice(0, MAX_EVIDENCE_ITEMS_FOR_MODEL)

  return prioritized.map((item) => ({
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    title: item.title.slice(0, MAX_TITLE_CHARS),
    snippet: item.snippet.slice(0, MAX_SNIPPET_CHARS),
    locator: item.locator || {},
  }))
}

export async function generatePreVisitChart({
  chartType,
  template,
  evidenceItems,
}: {
  chartType: PreVisitChartType
  template: HealixPreChartTemplate
  evidenceItems: PreVisitEvidenceItem[]
}): Promise<ChartGenerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  const variant = template.variants[chartType]
  const openai = getOpenAIClient()

  const promptEvidence = formatEvidenceForPrompt(evidenceItems)

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You generate evidence-grounded pre-visit charts. Use only provided evidence. Never hallucinate. If evidence is missing, explicitly state "No supporting evidence found". Return strict JSON.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Generate a pre-visit chart',
          chartType,
          template,
          requiredSections: variant.sections,
          smartPhrases: variant.smartPhrases,
          formattingPreferences: template.formattingPreferences || {},
          evidence: promptEvidence,
          allowedSourceIds: promptEvidence.map((item) => item.sourceId),
          outputSchema: {
            sections: [
              {
                id: 'section id from requiredSections',
                title: 'section title',
                content: 'generated text',
                sourceIds: ['source id list used for this section'],
              },
            ],
          },
        }),
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content?.trim() || ''
  let parsed: { sections?: RawGeneratedSection[] } = {}

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Model returned invalid chart JSON')
  }

  const sections = Array.isArray(parsed.sections) ? parsed.sections : []
  if (sections.length === 0) {
    throw new Error('Chart generation returned no sections')
  }

  let validated: ReturnType<typeof validateAndNumberCitations>
  try {
    validated = validateAndNumberCitations({
      sections,
      evidenceItems,
    })
  } catch (error) {
    const isCitationError =
      error instanceof Error &&
      (error.message.includes('Invalid citation source IDs') ||
        error.message.includes('contains content without evidence citations'))

    if (!isCitationError) {
      throw error
    }

    const repairCompletion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Repair chart section citations only. Keep original clinical meaning. Use only allowedSourceIds exactly as provided. Return strict JSON.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Repair invalid or missing citations for pre-visit chart output',
            validationError: error.message,
            allowedSourceIds: promptEvidence.map((item) => item.sourceId),
            draftSections: sections,
            outputSchema: {
              sections: [
                {
                  id: 'section id',
                  title: 'section title',
                  content: 'generated text',
                  sourceIds: ['source id list used for this section'],
                },
              ],
            },
          }),
        },
      ],
    })

    const repairRaw = repairCompletion.choices[0]?.message?.content?.trim() || ''
    let repairedParsed: { sections?: RawGeneratedSection[] } = {}
    try {
      repairedParsed = JSON.parse(repairRaw)
    } catch {
      throw new Error(`Chart generation citation repair returned invalid JSON: ${error.message}`)
    }

    const repairedSections = Array.isArray(repairedParsed.sections) ? repairedParsed.sections : []
    if (repairedSections.length === 0) {
      throw new Error(`Chart generation citation repair returned no sections: ${error.message}`)
    }

    validated = validateAndNumberCitations({
      sections: repairedSections,
      evidenceItems,
    })
  }

  return {
    sections: validated.sections,
    references: validated.references,
    generationMeta: {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      generatedAt: new Date().toISOString(),
      chartType,
      evidenceItemsSentToModel: Math.min(evidenceItems.length, MAX_EVIDENCE_ITEMS_FOR_MODEL),
    },
  }
}

export async function answerPreVisitQuestion({
  question,
  evidenceItems,
}: {
  question: string
  evidenceItems: PreVisitEvidenceItem[]
}): Promise<QuestionAnswerResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Answer only with provided evidence. If evidence is missing, say no supporting evidence found. Return strict JSON.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          question,
          evidence: formatEvidenceForPrompt(evidenceItems),
          outputSchema: {
            answer: 'answer string',
            sourceIds: ['source ids used'],
          },
        }),
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content?.trim() || ''
  let parsed: { answer?: string; sourceIds?: string[] } = {}

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Model returned invalid answer JSON')
  }

  const answer = parsed.answer?.trim()
  if (!answer) {
    throw new Error('Model returned empty answer')
  }

  const validated = validateAndNumberCitations({
    sections: [
      {
        id: 'answer',
        title: 'Answer',
        content: answer,
        sourceIds: Array.isArray(parsed.sourceIds) ? parsed.sourceIds : [],
      },
    ],
    evidenceItems,
  })

  return {
    answer,
    references: validated.references,
  }
}
