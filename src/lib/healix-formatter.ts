/**
 * Helper functions to format Healix responses for display
 */

export interface ParsedHealixResponse {
  answer: string
  assumptions: string[]
  questions: string[]
  suggestedActions: Array<{
    id: string
    label: string
    risk: string
    tool: string
    args: any
    why: string
  }>
}

/**
 * Parse and format a Healix response (can be JSON string or object)
 */
export function parseHealixResponse(response: string | object): ParsedHealixResponse {
  let parsed: any

  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response)
    } catch (e) {
      // If it's not JSON, treat as plain text answer
      return {
        answer: response,
        assumptions: [],
        questions: [],
        suggestedActions: [],
      }
    }
  } else {
    parsed = response
  }

  return {
    answer: parsed.answer || '',
    assumptions: parsed.assumptions || [],
    questions: parsed.questions || [],
    suggestedActions: parsed.suggested_actions || [],
  }
}

/**
 * Format markdown text for display
 * Simple markdown to HTML conversion for common cases
 */
export function formatMarkdown(text: string): string {
  if (!text) return ''

  let formatted = text

  // Escape HTML to prevent XSS
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Handle bold **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  // Handle italic *text*
  formatted = formatted.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')

  // Handle links [text](url) - show as text with link
  formatted = formatted.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')

  // Handle code blocks ```code```
  formatted = formatted.replace(/```([^`]+)```/g, '<pre class="bg-gray-100 p-2 rounded text-xs overflow-x-auto"><code>$1</code></pre>')

  // Handle inline code `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">$1</code>')

  // Handle headers # Header
  formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-lg mt-4 mb-2">$1</h3>')
  formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-xl mt-4 mb-2">$1</h2>')
  formatted = formatted.replace(/^# (.+)$/gm, '<h1 class="font-bold text-2xl mt-4 mb-2">$1</h1>')

  // Handle bullet points - and *
  formatted = formatted.replace(/^[\*\-\+] (.+)$/gm, '• $1')

  // Handle numbered lists
  formatted = formatted.replace(/^\d+\. (.+)$/gm, '$1.')

  // Handle line breaks (convert double newlines to paragraphs)
  formatted = formatted.replace(/\n\n+/g, '</p><p class="my-2">')
  
  // Handle single newlines as <br>
  formatted = formatted.replace(/\n/g, '<br />')

  // Wrap in paragraph tags
  formatted = `<p class="my-2">${formatted}</p>`

  return formatted
}

/**
 * Extract and format the answer portion from a response
 */
export function extractAnswer(response: string | object): string {
  const parsed = parseHealixResponse(response)
  return parsed.answer || ''
}

