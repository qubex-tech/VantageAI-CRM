import OpenAI from 'openai'
import type {
  HealixPreChartTemplate,
  PreVisitChartSectionOutput,
  PreVisitChartType,
  PreVisitEvidenceItem,
} from '@/lib/previsit/types'
import { validateAndNumberCitations, type RawGeneratedSection } from '@/lib/previsit/citations'

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
  return evidenceItems.map((item) => ({
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    title: item.title,
    snippet: item.snippet,
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
          evidence: formatEvidenceForPrompt(evidenceItems),
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

  const validated = validateAndNumberCitations({
    sections,
    evidenceItems,
  })

  return {
    sections: validated.sections,
    references: validated.references,
    generationMeta: {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      generatedAt: new Date().toISOString(),
      chartType,
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
