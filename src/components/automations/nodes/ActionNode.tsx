'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { PlayCircle, Mail, MessageSquare, FileText, User, Clock } from 'lucide-react'
import { FlowNodeData } from '../FlowBuilder'

const actionIcons: Record<string, any> = {
  send_email: Mail,
  send_sms: MessageSquare,
  create_note: FileText,
  create_task: PlayCircle,
  update_patient_fields: User,
  delay_seconds: Clock,
}

export const ActionNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  const actionType = data.config?.actionType || 'action'
  const Icon = actionIcons[actionType] || PlayCircle

  return (
    <div
      className={`px-4 py-3 bg-white rounded-lg shadow-md border-2 min-w-[200px] ${
        selected ? 'border-amber-500' : 'border-amber-300'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-amber-100 rounded">
          <Icon className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-500 uppercase">Action</div>
          <div className="text-sm font-semibold text-gray-900">{data.label}</div>
        </div>
      </div>

      {actionType && actionType !== 'action' && (
        <div className="mt-2 px-2 py-1 bg-gray-50 rounded text-xs text-gray-600">
          {actionType.replace(/_/g, ' ')}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-500"
        style={{ top: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-amber-500"
        style={{ top: '50%' }}
      />
    </div>
  )
})

ActionNode.displayName = 'ActionNode'

