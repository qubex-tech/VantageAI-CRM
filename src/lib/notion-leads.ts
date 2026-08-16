/**
 * Best-effort sync of marketing form leads into the Website Prospects Notion DB.
 * No-op unless NOTION_TOKEN and NOTION_LEADS_DATABASE_ID are set.
 */

export type NotionLeadInput = {
  id: string
  practiceName: string
  contactName: string
  workEmail: string
  practiceWebsite?: string | null
  practiceType: string
  providerCount: string
  automationFocus: string
  source?: string | null
  createdAt?: Date
}

function richText(content: string) {
  return [{ type: 'text' as const, text: { content: content.slice(0, 2000) } }]
}

function normalizeUrl(raw?: string | null): string | null {
  const value = (raw || '').trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

export async function syncLeadToNotion(lead: NotionLeadInput): Promise<void> {
  const token = process.env.NOTION_TOKEN
  const databaseId = process.env.NOTION_LEADS_DATABASE_ID
  if (!token || !databaseId) return

  const website = normalizeUrl(lead.practiceWebsite)
  const properties: Record<string, unknown> = {
    Practice: { title: richText(lead.practiceName) },
    'Contact name': { rich_text: richText(lead.contactName) },
    'Work email': { email: lead.workEmail },
    'Practice type': { select: { name: lead.practiceType } },
    Providers: { select: { name: lead.providerCount } },
    'Automation focus': { select: { name: lead.automationFocus } },
    Status: { select: { name: 'New' } },
    'CRM lead id': { rich_text: richText(lead.id) },
    'Submitted at': {
      date: { start: (lead.createdAt || new Date()).toISOString() },
    },
  }
  if (website) {
    properties.Website = { url: website }
  }
  if (lead.source) {
    properties.Source = { rich_text: richText(lead.source) }
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Notion ${response.status}: ${body.slice(0, 400)}`)
  }
}
