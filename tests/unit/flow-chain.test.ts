import { describe, expect, it } from 'vitest'
import {
  countActionsBeforeCondition,
  getEvaluateAfterActionCount,
  orderedFlowNodes,
} from '@/automations/flow-chain'

describe('flow-chain', () => {
  const nodes = [
    { id: 'trigger-0', type: 'trigger' },
    { id: 'action-delay', type: 'action' },
    { id: 'condition-0', type: 'condition' },
    { id: 'action-wait', type: 'action' },
    { id: 'action-curogram', type: 'action' },
  ]
  const edges = [
    { source: 'trigger-0', target: 'action-delay' },
    { source: 'action-delay', target: 'condition-0' },
    { source: 'condition-0', target: 'action-wait' },
    { source: 'action-wait', target: 'action-curogram' },
  ]

  it('walks the connected chain instead of node insertion order', () => {
    const insertedLastFirst = [
      nodes[4],
      nodes[3],
      nodes[2],
      nodes[1],
      nodes[0],
    ]
    expect(orderedFlowNodes(insertedLastFirst, edges).map((node) => node.id)).toEqual([
      'trigger-0',
      'action-delay',
      'condition-0',
      'action-wait',
      'action-curogram',
    ])
  })

  it('counts only actions before the condition node', () => {
    expect(countActionsBeforeCondition(nodes, edges)).toBe(1)
  })

  it('reads evaluateAfterActionCount from saved conditions', () => {
    expect(getEvaluateAfterActionCount({ operator: 'and', conditions: [], evaluateAfterActionCount: 1 })).toBe(1)
    expect(getEvaluateAfterActionCount({ operator: 'and', conditions: [] })).toBe(0)
  })
})
