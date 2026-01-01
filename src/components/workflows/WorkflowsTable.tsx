'use client'

import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { Workflow, AlertTriangle, Clock, User, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WorkflowRun {
  id: string
  status: string
  startedAt: Date
  completedAt: Date | null
}

interface WorkflowWithStats {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date | null
  runCount: number
  lastFailedRun?: Date | null
  createdByName?: string | null
}

interface WorkflowsTableProps {
  workflows: WorkflowWithStats[]
}

function getStatusBadge(isActive: boolean) {
  if (isActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Published
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      Draft
    </span>
  )
}

function getWorkflowIcon(name: string) {
  // Generate a color based on the workflow name for consistency
  const colors = [
    'bg-green-100 text-green-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-yellow-100 text-yellow-700',
  ]
  const colorIndex = name.length % colors.length
  return colors[colorIndex]
}

export function WorkflowsTable({ workflows }: WorkflowsTableProps) {
  // Group workflows by status
  const publishedWorkflows = workflows.filter(w => w.isActive)
  const draftWorkflows = workflows.filter(w => !w.isActive)

  return (
    <div className="space-y-6">
      {publishedWorkflows.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Published ({publishedWorkflows.length})</h2>
          <WorkflowsTableSection workflows={publishedWorkflows} />
        </div>
      )}

      {draftWorkflows.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Unpublished ({draftWorkflows.length})</h2>
          <WorkflowsTableSection workflows={draftWorkflows} />
        </div>
      )}

      {workflows.length === 0 && (
        <div className="text-center py-12 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500 mb-4">No workflows created yet</p>
          <Link href="/automations/workflows/new">
            <Button variant="outline">Create your first workflow</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

function WorkflowsTableSection({ workflows }: { workflows: WorkflowWithStats[] }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Workflow
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Workflow className="h-4 w-4" />
                  Runs
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Status
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Created by
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Last published
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Last failed run
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workflows.map((workflow) => (
              <tr
                key={workflow.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/automations/workflows/${workflow.id}`}
              >
                <td className="px-4 py-4">
                  <Link
                    href={`/automations/workflows/${workflow.id}`}
                    className="flex items-center gap-3 group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${getWorkflowIcon(workflow.name)}`}>
                      <Workflow className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 group-hover:text-gray-700">
                        {workflow.name || 'Untitled Workflow'}
                      </div>
                      {workflow.description && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {workflow.description}
                        </div>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {workflow.runCount}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {getStatusBadge(workflow.isActive)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {workflow.createdByName ? (
                      <>
                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-orange-700">
                            {workflow.createdByName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-gray-900">{workflow.createdByName}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {workflow.publishedAt ? (
                    <div>
                      <div className="text-gray-900">{format(workflow.publishedAt, 'MMM d, yyyy')}</div>
                      <div className="text-xs text-gray-500">{formatDistanceToNow(workflow.publishedAt, { addSuffix: true })}</div>
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {workflow.lastFailedRun ? (
                    <div>
                      <div className="text-gray-900">{format(workflow.lastFailedRun, 'MMM d, yyyy')}</div>
                      <div className="text-xs text-gray-500">{formatDistanceToNow(workflow.lastFailedRun, { addSuffix: true })}</div>
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

