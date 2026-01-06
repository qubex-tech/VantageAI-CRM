'use client'

import { useCallback, useState, useMemo, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  BackgroundVariant,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { TriggerNode } from './nodes/TriggerNode'
import { ConditionNode } from './nodes/ConditionNode'
import { ActionNode } from './nodes/ActionNode'
import { NodeSidebar } from './NodeSidebar'
import { NodeConfigPanel } from './NodeConfigPanel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Save, Play, Trash2, Plus } from 'lucide-react'

export interface FlowNodeData {
  label: string
  type: 'trigger' | 'condition' | 'action'
  config?: any
  [key: string]: any
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
}

const initialNodes: Node<FlowNodeData>[] = []
const initialEdges: Edge[] = []

interface FlowBuilderProps {
  initialWorkflow?: {
    nodes: Node<FlowNodeData>[]
    edges: Edge[]
  }
  onSave?: (workflow: { nodes: Node<FlowNodeData>[]; edges: Edge[] }) => void
  onTest?: () => void
  onWorkflowChange?: (workflow: { nodes: Node<FlowNodeData>[]; edges: Edge[] }) => void
}

export function FlowBuilder({ initialWorkflow, onSave, onTest, onWorkflowChange }: FlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialWorkflow?.nodes || initialNodes
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialWorkflow?.edges || initialEdges
  )
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)

  // Notify parent of workflow changes
  useEffect(() => {
    if (onWorkflowChange) {
      onWorkflowChange({ nodes, edges })
    }
  }, [nodes, edges, onWorkflowChange])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<FlowNodeData>) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const addNode = useCallback(
    (type: 'trigger' | 'condition' | 'action', nodeData: Partial<FlowNodeData>) => {
      const newNode: Node<FlowNodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 400 + 100,
        },
        data: {
          label: nodeData.label || `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          type,
          ...nodeData,
        },
      }

      // If it's a trigger, ensure it's the only trigger
      if (type === 'trigger') {
        setNodes((nds) => {
          const filtered = nds.filter((n) => n.type !== 'trigger')
          return [...filtered, newNode]
        })
      } else {
        setNodes((nds) => [...nds, newNode])
      }
    },
    [setNodes]
  )

  const updateNodeConfig = useCallback(
    (nodeId: string, updates: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            // If updates contains a config object, merge it properly
            const updatedConfig = updates.config !== undefined 
              ? { ...node.data.config, ...updates.config }
              : node.data.config
            
            return {
              ...node,
              data: {
                ...node.data,
                ...updates,
                config: updatedConfig,
              },
            }
          }
          return node
        })
      )
      if (selectedNode?.id === nodeId) {
        const updatedConfig = updates.config !== undefined 
          ? { ...selectedNode.data.config, ...updates.config }
          : selectedNode.data.config
        
        setSelectedNode({
          ...selectedNode,
          data: {
            ...selectedNode.data,
            ...updates,
            config: updatedConfig,
          },
        })
      }
    },
    [setNodes, selectedNode]
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId))
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null)
      }
    },
    [setNodes, setEdges, selectedNode]
  )

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({ nodes, edges })
    }
  }, [nodes, edges, onSave])

  const handleTest = useCallback(() => {
    if (onTest) {
      onTest()
    }
  }, [onTest])

  // Get trigger node
  const triggerNode = useMemo(() => nodes.find((n) => n.type === 'trigger'), [nodes])

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">Workflow Builder</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? 'Hide' : 'Show'} Nodes
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTest}>
            <Play className="h-4 w-4 mr-2" />
            Test
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
            <NodeSidebar onAddNode={addNode} />
          </div>
        )}

        {/* Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'trigger') return '#10b981'
                if (node.type === 'condition') return '#3b82f6'
                return '#f59e0b'
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
            {!triggerNode && (
              <Panel position="top-center" className="mt-4">
                <Card className="px-4 py-3 bg-blue-50 border-blue-200">
                  <p className="text-sm text-blue-800">
                    👆 Start by adding a <strong>Trigger</strong> node from the sidebar
                  </p>
                </Card>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Configuration Panel */}
        {selectedNode && (
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
            <NodeConfigPanel
              node={selectedNode}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
              triggerEventName={triggerNode?.data.config?.eventName}
            />
          </div>
        )}
      </div>
    </div>
  )
}

