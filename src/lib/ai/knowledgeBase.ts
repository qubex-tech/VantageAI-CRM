export interface KnowledgeBaseMatch {
  id: string
  title: string
  url?: string
  snippet?: string
}

// Placeholder for KB retrieval. Replace with vector search or KB service.
export async function retrieveKnowledgeBaseMatches({
  query,
  limit = 3,
}: {
  query: string
  limit?: number
}): Promise<KnowledgeBaseMatch[]> {
  void query
  void limit
  return []
}
