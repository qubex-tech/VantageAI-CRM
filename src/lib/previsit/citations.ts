import type { PreVisitChartReference, PreVisitChartSectionOutput, PreVisitEvidenceItem } from '@/lib/previsit/types'

export interface RawGeneratedSection {
  id: string
  title: string
  content: string
  sourceIds: string[]
}

function isSafeNoEvidenceStatement(content: string) {
  const normalized = content.toLowerCase()
  return (
    normalized.includes('no supporting evidence') ||
    normalized.includes('evidence was not found') ||
    normalized.includes('insufficient evidence')
  )
}

export function validateAndNumberCitations({
  sections,
  evidenceItems,
}: {
  sections: RawGeneratedSection[]
  evidenceItems: PreVisitEvidenceItem[]
}) {
  const evidenceIds = new Set(evidenceItems.map((item) => item.sourceId))
  const numbering = new Map<string, number>()
  let nextNumber = 1

  const normalizedSections: PreVisitChartSectionOutput[] = sections.map((section) => {
    const uniqueSourceIds = Array.from(new Set(section.sourceIds || []))
    const validSourceIds = uniqueSourceIds.filter((sourceId) => evidenceIds.has(sourceId))
    const unknownSourceIds = uniqueSourceIds.filter((sourceId) => !evidenceIds.has(sourceId))

    if (unknownSourceIds.length > 0) {
      throw new Error(`Invalid citation source IDs: ${unknownSourceIds.join(', ')}`)
    }

    if (section.content.trim() && validSourceIds.length === 0 && !isSafeNoEvidenceStatement(section.content)) {
      throw new Error(`Section "${section.title}" contains content without evidence citations`)
    }

    const references: PreVisitChartReference[] = validSourceIds.map((sourceId) => {
      if (!numbering.has(sourceId)) {
        numbering.set(sourceId, nextNumber)
        nextNumber += 1
      }
      return {
        number: numbering.get(sourceId)!,
        sourceId,
      }
    })

    return {
      id: section.id,
      title: section.title,
      content: section.content,
      references,
    }
  })

  const numberedSources = Array.from(numbering.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([sourceId, number]) => ({
      number,
      sourceId,
      source: evidenceItems.find((item) => item.sourceId === sourceId)!,
    }))

  return {
    sections: normalizedSections,
    references: numberedSources,
  }
}
