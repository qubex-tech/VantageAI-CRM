import type { DraftConfidence } from './generateDraftReply'

export type RewriteMode = 'shorten' | 'empathetic' | 'direct' | 'spanish'

export interface RewriteResult {
  draftText: string
  confidence: DraftConfidence
}

const citationRegex = /(\[[^\]]+\])/g

function splitWithCitations(text: string) {
  return text.split(citationRegex).filter(Boolean)
}

function joinWithCitations(parts: string[]) {
  return parts.join('')
}

function shortenText(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  return sentences.slice(0, 2).join(' ')
}

function makeEmpathetic(text: string) {
  if (text.toLowerCase().startsWith('thanks')) return text
  return `Thanks for reaching out. ${text}`
}

function makeDirect(text: string) {
  return text.replace(/^Thanks for reaching out\.\s*/i, '').trim()
}

function toSpanish(text: string) {
  return `Gracias por comunicarse. ${text}`.replace('Please let us know', 'Por favor indíquenos')
}

// LLM abstraction placeholder - replace with provider implementation.
export async function rewriteDraftReply(
  draftText: string,
  mode: RewriteMode
): Promise<RewriteResult> {
  const parts = splitWithCitations(draftText)
  const rewritten = parts.map((part) => {
    if (citationRegex.test(part)) return part
    switch (mode) {
      case 'shorten':
        return shortenText(part)
      case 'empathetic':
        return makeEmpathetic(part)
      case 'direct':
        return makeDirect(part)
      case 'spanish':
        return toSpanish(part)
      default:
        return part
    }
  })

  return {
    draftText: joinWithCitations(rewritten),
    confidence: 'medium',
  }
}
