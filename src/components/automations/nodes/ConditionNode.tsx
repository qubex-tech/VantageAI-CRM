'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { GitBranch } from 'lucide-react'
import { FlowNodeData } from '../FlowBuilder'

export const ConditionNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  const conditionCount = data.config?.conditions?.length || 0

  return (
    <div
      className={`px-4 py-3 bg-white rounded-lg shadow-md border-2 min-w-[200px] ${
        selected ? 'border-blue-500' : 'border-blue-300'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-blue-100 rounded">
          <GitBranch className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-500 uppercase">Condition</div>
          <div className="text-sm font-semibold text-gray-900">{data.label}</div>
        </div>
      </div>

      {conditionCount > 0 && (
        <div className="mt-2 px-2 py-1 bg-gray-50 rounded text-xs text-gray-600">
          {conditionCount} condition{conditionCount !== 1 ? 's' : ''}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500"
        style={{ top: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500"
        style={{ top: '50%' }}
      />
    </div>
  )
})

ConditionNode.displayName = 'ConditionNode'

