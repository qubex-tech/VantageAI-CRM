export type ChainNode = {
  id: string
  type?: string
  data?: any
}

export type ChainEdge = {
  source: string
  target: string
}

export function getEvaluateAfterActionCount(conditionsJson: unknown): number {
  if (!conditionsJson || typeof conditionsJson !== 'object') return 0
  const n = (conditionsJson as { evaluateAfterActionCount?: unknown }).evaluateAfterActionCount
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return 0
  return n
}

/** Follow the trigger's outgoing edges so save/load keep Delay → Condition → Send order. */
export function orderedFlowNodes<T extends ChainNode>(nodes: T[], edges: ChainEdge[]): T[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue
    const list = outgoing.get(edge.source) || []
    list.push(edge.target)
    outgoing.set(edge.source, list)
  }

  const trigger = nodes.find((node) => node.type === 'trigger')
  if (!trigger) return nodes

  const ordered: T[] = [trigger]
  const seen = new Set<string>([trigger.id])
  let current = trigger.id
  while (true) {
    const nextIds = outgoing.get(current) || []
    const nextId = nextIds.find((id) => !seen.has(id) && byId.has(id))
    if (!nextId) break
    const next = byId.get(nextId)
    if (!next) break
    seen.add(nextId)
    ordered.push(next)
    current = nextId
  }

  for (const node of nodes) {
    if (!seen.has(node.id)) ordered.push(node)
  }
  return ordered
}

export function countActionsBeforeCondition(nodes: ChainNode[], edges: ChainEdge[]): number {
  const ordered = orderedFlowNodes(nodes, edges)
  let count = 0
  for (const node of ordered) {
    if (node.type === 'condition') return count
    if (node.type === 'action') count += 1
  }
  return 0
}
