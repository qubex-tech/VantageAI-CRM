'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, Pause, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Workflow {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface WorkflowsListProps {
  initialWorkflows: Workflow[]
}

export function WorkflowsList({ initialWorkflows }: WorkflowsListProps) {
  if (initialWorkflows.length === 0) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500 mb-4">No workflows created yet</p>
          <Link href="/automations/workflows/new">
            <Button variant="outline">Create your first workflow</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {initialWorkflows.map((workflow) => (
        <Link key={workflow.id} href={`/automations/workflows/${workflow.id}`}>
          <Card className="border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900">{workflow.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {workflow.isActive ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                      Draft
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {workflow.description && (
                <p className="text-sm text-gray-600 mb-4">{workflow.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      // TODO: Toggle workflow active status
                    }}
                  >
                    {workflow.isActive ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Link
                    href={`/automations/workflows/${workflow.id}/settings`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

