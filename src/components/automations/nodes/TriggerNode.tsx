'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Zap } from 'lucide-react'
import { FlowNodeData } from '../FlowBuilder'

export const TriggerNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <div
      className={`px-4 py-3 bg-white rounded-lg shadow-md border-2 min-w-[200px] ${
        selected ? 'border-green-500' : 'border-green-300'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-green-100 rounded">
          <Zap className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-500 uppercase">Trigger</div>
          <div className="text-sm font-semibold text-gray-900">{data.label}</div>
        </div>
      </div>
      
      {data.config?.eventName && (
        <div className="mt-2 px-2 py-1 bg-gray-50 rounded text-xs text-gray-600">
          {data.config.eventName.replace('crm/', '')}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500"
        style={{ top: '50%' }}
      />
    </div>
  )
})

TriggerNode.displayName = 'TriggerNode'

