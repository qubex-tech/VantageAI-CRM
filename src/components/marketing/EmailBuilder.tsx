'use client'

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Trash2,
  Copy,
  Image as ImageIcon,
  Type,
  Square,
  Minus,
  ArrowUpDown,
  MousePointer,
  Smartphone,
  Monitor,
  Undo2,
  Redo2,
  Save,
  Eye,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Link as LinkIcon,
  Code,
  Share2,
  Play,
  FileCode,
  Package,
  Layers,
  Library,
  Plus,
  Copy as DuplicateIcon,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { EmailDoc, Row, Column, Block, Block as BlockType } from '@/lib/marketing/types'
import dynamic from 'next/dynamic'
import VariablePicker from './VariablePicker'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'

interface EmailBuilderProps {
  initialDoc?: EmailDoc
  brandProfile?: any
  onSave: (doc: EmailDoc) => Promise<void>
  onPreview?: () => void
  saving?: boolean
  previewMode?: 'desktop' | 'mobile'
  onPreviewModeChange?: (mode: 'desktop' | 'mobile') => void
}

export interface EmailBuilderRef {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const EmailBuilder = forwardRef<EmailBuilderRef, EmailBuilderProps>(function EmailBuilder({
  initialDoc,
  brandProfile,
  onSave,
  onPreview,
  saving = false,
  previewMode: externalPreviewMode,
  onPreviewModeChange,
}, ref) {
  const [savedBlocks, setSavedBlocks] = useState<Array<{ id: string; name: string; category?: string }>>([])
  const [loadingSavedBlocks, setLoadingSavedBlocks] = useState(false)
  const [doc, setDoc] = useState<EmailDoc>(
    initialDoc || {
      rows: [
        {
          id: 'row-1',
          columns: [
            {
              id: 'col-1',
              width: 100,
              blocks: [],
            },
          ],
        },
      ],
      globalStyles: {
        fontFamily: (brandProfile?.fontFamily as any) || 'Arial',
        primaryColor: brandProfile?.primaryColor || '#2563eb',
        secondaryColor: brandProfile?.secondaryColor || '#64748b',
        buttonRadius: '6px',
        buttonColor: brandProfile?.primaryColor || '#2563eb',
        linkColor: '#2563eb',
      },
    }
  )

  const [selectedBlock, setSelectedBlock] = useState<{ rowId: string; colId: string; blockIndex: number } | null>(null)

  // Load saved content blocks
  useEffect(() => {
    const loadSavedBlocks = async () => {
      try {
        setLoadingSavedBlocks(true)
        const response = await fetch('/api/marketing/content-blocks')
        if (response.ok) {
          const data = await response.json()
          setSavedBlocks(data.blocks || [])
        }
      } catch (error) {
        console.error('Failed to load saved blocks:', error)
      } finally {
        setLoadingSavedBlocks(false)
      }
    }
    loadSavedBlocks()
  }, [])
  const [selectedRow, setSelectedRow] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>(externalPreviewMode || 'desktop')
  const [history, setHistory] = useState<EmailDoc[]>([doc])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [showVariablePicker, setShowVariablePicker] = useState(false)
  
  // Sync external preview mode
  useEffect(() => {
    if (externalPreviewMode !== undefined) {
      setPreviewMode(externalPreviewMode)
    }
  }, [externalPreviewMode])
  
  const handlePreviewModeChange = (mode: 'desktop' | 'mobile') => {
    setPreviewMode(mode)
    onPreviewModeChange?.(mode)
  }
  const [variablePickerPosition, setVariablePickerPosition] = useState<{ x: number; y: number } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    activeId.current = active.id.toString()
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    // Allow dropping on columns
  }
  
  // Handle HTML5 drag-and-drop from palette (separate from DndContext)
  const handlePaletteDrop = (e: React.DragEvent, rowId: string, colId: string) => {
    e.preventDefault()
    const blockType = e.dataTransfer.getData('blockType')
    if (blockType) {
      const newBlock = createNewBlock(blockType)
      addBlockToRow(rowId, colId, newBlock)
    }
  }
  
  const handlePaletteDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const activeId = useRef<string | null>(null)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      activeId.current = null
      return
    }

    // Handle reordering blocks within a column (DndContext)
    const activeData = active.data.current
    const overId = over.id.toString()
    
    if (activeId.current?.startsWith('block-') && overId.startsWith('block-')) {
      const { rowId, colId, blockIndex } = activeData || {}
      const overData = over.data.current
      
      if (rowId && colId && blockIndex !== undefined && overData &&
          overData.rowId === rowId && overData.colId === colId &&
          overData.blockIndex !== undefined) {
        const row = doc.rows.find((r) => r.id === rowId)
        if (!row) {
          activeId.current = null
          return
        }

        const col = row.columns.find((c) => c.id === colId)
        if (!col) {
          activeId.current = null
          return
        }

        const newIndex = overData.blockIndex
        if (blockIndex !== newIndex) {
          const newBlocks = arrayMove(col.blocks, blockIndex, newIndex)
          updateBlockInColumn(rowId, colId, newBlocks)
        }
      }
    }
    
    activeId.current = null
  }

  const createNewBlock = (type: string): Block => {
    const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    switch (type) {
      case 'text':
        return {
          type: 'text',
          content: '<p>Enter your text here...</p>',
          style: {
            fontSize: '16px',
            color: '#333333',
            textAlign: 'left',
            padding: '20px',
          },
        }
      case 'image':
        return {
          type: 'image',
          url: '',
          alt: 'Image',
          style: {
            align: 'center',
          },
        }
      case 'button':
        return {
          type: 'button',
          label: 'Click Here',
          url: '#',
          style: {
            backgroundColor: doc.globalStyles?.buttonColor || '#2563eb',
            textColor: '#ffffff',
            borderRadius: doc.globalStyles?.buttonRadius || '6px',
            padding: '12px 24px',
          },
        }
      case 'divider':
        return {
          type: 'divider',
          style: {
            color: '#e5e7eb',
            thickness: '1px',
          },
        }
      case 'spacer':
        return {
          type: 'spacer',
          height: '20px',
        }
      case 'header':
        return {
          type: 'header',
          logo: true,
        }
      case 'footer':
        return {
          type: 'footer',
          showUnsubscribe: true,
        }
      case 'social':
        return {
          type: 'social',
          links: [
            { platform: 'facebook', url: '' },
            { platform: 'twitter', url: '' },
            { platform: 'instagram', url: '' },
          ],
          style: {
            align: 'center',
            iconSize: '24px',
            spacing: '12px',
          },
        }
      case 'video':
        return {
          type: 'video',
          url: '',
          thumbnail: '',
          alt: 'Video',
          style: {
            width: '100%',
            align: 'center',
          },
        }
      case 'html':
        return {
          type: 'html',
          content: '<!-- Add your custom HTML here -->',
          style: {
            padding: '20px',
          },
        }
      case 'product':
        return {
          type: 'product',
          name: 'Product Name',
          description: 'Product description',
          imageUrl: '',
          price: '$0.00',
          buttonLabel: 'Learn More',
          buttonUrl: '#',
          style: {
            layout: 'horizontal',
            imageAlign: 'left',
          },
        }
      default:
        return {
          type: 'text',
          content: '<p>New block</p>',
        }
    }
  }

  const getBlockId = (block: Block): string => {
    // Generate a stable ID for a block based on its position
    return `block-${JSON.stringify(block).substring(0, 50)}`
  }

  const addBlockToRow = (rowId: string, colId: string, block: Block) => {
    const newDoc = { ...doc }
    let row = newDoc.rows.find((r) => r.id === rowId)
    
    // Create row if it doesn't exist
    if (!row) {
      row = {
        id: rowId,
        columns: [
          {
            id: colId,
            width: 100,
            blocks: [block],
          },
        ],
      }
      newDoc.rows.push(row)
    } else {
      const col = row.columns.find((c) => c.id === colId)
      if (!col) {
        // Create column if it doesn't exist
        row.columns.push({
          id: colId,
          width: 100,
          blocks: [block],
        })
      } else {
        col.blocks.push(block)
      }
    }

    updateDoc(newDoc)
  }

  const updateBlockInColumn = (rowId: string, colId: string, blocks: Block[]) => {
    const newDoc = { ...doc }
    const row = newDoc.rows.find((r) => r.id === rowId)
    if (!row) return

    const col = row.columns.find((c) => c.id === colId)
    if (!col) return

    col.blocks = blocks
    updateDoc(newDoc)
  }

  const updateBlock = (updates: Partial<Block>) => {
    if (!selectedBlock) return

    const { rowId, colId, blockIndex } = selectedBlock
    const newDoc = { ...doc }
    const row = newDoc.rows.find((r) => r.id === rowId)
    if (!row) return

    const col = row.columns.find((c) => c.id === colId)
    if (!col || !col.blocks[blockIndex]) return

    col.blocks[blockIndex] = { ...col.blocks[blockIndex], ...updates } as Block
    updateDoc(newDoc)
  }

  const deleteBlock = () => {
    if (!selectedBlock) return

    const { rowId, colId, blockIndex } = selectedBlock
    const newDoc = { ...doc }
    const row = newDoc.rows.find((r) => r.id === rowId)
    if (!row) return

    const col = row.columns.find((c) => c.id === colId)
    if (!col) return

    col.blocks.splice(blockIndex, 1)
    updateDoc(newDoc)
    setSelectedBlock(null)
  }

  const duplicateBlock = () => {
    if (!selectedBlock) return

    const { rowId, colId, blockIndex } = selectedBlock
    const newDoc = { ...doc }
    const row = newDoc.rows.find((r) => r.id === rowId)
    if (!row) return

    const col = row.columns.find((c) => c.id === colId)
    if (!col || !col.blocks[blockIndex]) return

    const blockToDuplicate = col.blocks[blockIndex]
    col.blocks.splice(blockIndex + 1, 0, JSON.parse(JSON.stringify(blockToDuplicate)))
    updateDoc(newDoc)
  }

  // Row/Section Management Functions
  const addRow = (columnCount: 1 | 2 | 3 | 4 = 1) => {
    const newDoc = { ...doc }
    const rowId = `row-${Date.now()}`
    const columns: Column[] = []
    
    const columnWidth = 100 / columnCount
    for (let i = 0; i < columnCount; i++) {
      columns.push({
        id: `col-${rowId}-${i}`,
        width: columnWidth,
        blocks: [],
      })
    }
    
    newDoc.rows.push({
      id: rowId,
      columns,
    })
    updateDoc(newDoc)
    setSelectedRow(rowId)
  }

  const deleteRow = (rowId: string) => {
    const newDoc = { ...doc }
    newDoc.rows = newDoc.rows.filter((r) => r.id !== rowId)
    updateDoc(newDoc)
    if (selectedRow === rowId) {
      setSelectedRow(null)
    }
    if (selectedBlock?.rowId === rowId) {
      setSelectedBlock(null)
    }
  }

  const duplicateRow = (rowId: string) => {
    const newDoc = { ...doc }
    const row = newDoc.rows.find((r) => r.id === rowId)
    if (!row) return

    const duplicatedRow = JSON.parse(JSON.stringify(row))
    duplicatedRow.id = `row-${Date.now()}`
    // Update column IDs
    duplicatedRow.columns = duplicatedRow.columns.map((col: Column, idx: number) => ({
      ...col,
      id: `col-${duplicatedRow.id}-${idx}`,
    }))

    const rowIndex = newDoc.rows.findIndex((r) => r.id === rowId)
    newDoc.rows.splice(rowIndex + 1, 0, duplicatedRow)
    updateDoc(newDoc)
    setSelectedRow(duplicatedRow.id)
  }

  const changeColumnLayout = (rowId: string, columnCount: 1 | 2 | 3 | 4) => {
    const newDoc = { ...doc }
    const row = newDoc.rows.find((r) => r.id === rowId)
    if (!row) return

    const columnWidth = 100 / columnCount
    const existingBlocks = row.columns.flatMap((col) => col.blocks)
    
    // Redistribute blocks across new columns
    const newColumns: Column[] = []
    for (let i = 0; i < columnCount; i++) {
      const blocksForColumn = existingBlocks.filter((_, idx) => idx % columnCount === i)
      newColumns.push({
        id: `col-${rowId}-${i}`,
        width: columnWidth,
        blocks: blocksForColumn,
      })
    }

    row.columns = newColumns
    updateDoc(newDoc)
  }

  const updateDoc = (newDoc: EmailDoc) => {
    setDoc(newDoc)
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newDoc)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setDoc(history[newIndex])
    }
  }, [historyIndex, history])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setDoc(history[newIndex])
    }
  }, [historyIndex, history.length, history])
  
  // Expose undo/redo functions to parent via ref
  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  }), [historyIndex, history.length, history, handleUndo, handleRedo])

  const selectedBlockData = selectedBlock
    ? doc.rows
        .find((r) => r.id === selectedBlock.rowId)
        ?.columns.find((c) => c.id === selectedBlock.colId)
        ?.blocks[selectedBlock.blockIndex] || undefined
    : undefined

  // Expose undo/redo handlers via ref or callbacks for parent toolbar
  // For now, we'll remove the toolbar and let parent handle everything
  
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex flex-1 overflow-hidden">
        {/* Block Palette */}
        <BlockPalette 
          onDragStart={(type) => {}} 
          onAddSavedBlock={async (block) => {
            try {
              const response = await fetch(`/api/marketing/content-blocks/${block.id}`)
              if (response.ok) {
                const data = await response.json()
                const blockData = data.block.blockData
                
                if (data.block.blockType === 'row') {
                  // Add as a new row
                  const newDoc = { ...doc }
                  newDoc.rows.push({
                    ...blockData,
                    id: `row-${Date.now()}`,
                  })
                  updateDoc(newDoc)
                } else {
                  // Add as a block to the first column of the first row
                  if (doc.rows.length === 0) {
                    addRow(1)
                  }
                  const firstRow = doc.rows[0]
                  if (firstRow && firstRow.columns.length > 0) {
                    const firstCol = firstRow.columns[0]
                    const newDoc = { ...doc }
                    const row = newDoc.rows.find((r) => r.id === firstRow.id)
                    if (row) {
                      const col = row.columns.find((c) => c.id === firstCol.id)
                      if (col) {
                        col.blocks.push(blockData)
                        updateDoc(newDoc)
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Failed to load saved block:', error)
            }
          }}
          savedBlocks={savedBlocks}
        />

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div
              className={`mx-auto bg-white shadow-lg ${
                previewMode === 'mobile' ? 'max-w-sm' : 'max-w-3xl'
              } min-h-screen`}
            >
              <Canvas
                doc={doc}
                selectedBlock={selectedBlock}
                selectedRow={selectedRow}
                onSelectBlock={(rowId, colId, blockIndex) =>
                  setSelectedBlock({ rowId, colId, blockIndex })
                }
                onSelectRow={(rowId) => setSelectedRow(rowId)}
                onDeleteBlock={deleteBlock}
                onDuplicateBlock={duplicateBlock}
                onAddRow={addRow}
                onDeleteRow={deleteRow}
                onDuplicateRow={duplicateRow}
                onChangeColumnLayout={changeColumnLayout}
                brandProfile={brandProfile}
                showVariablePicker={showVariablePicker}
                onInsertVariable={(variable) => {
                  // Variable insertion is handled in PropertiesPanel
                  setShowVariablePicker(false)
                }}
                onPaletteDrop={handlePaletteDrop}
                onPaletteDragOver={handlePaletteDragOver}
              />
            </div>
          </DndContext>
        </div>

        {/* Properties Panel */}
        <div className="relative">
          <PropertiesPanel
            block={selectedBlockData}
            doc={doc}
            onUpdate={updateBlock}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            brandProfile={brandProfile}
            onShowVariablePicker={() => {
              const panel = document.querySelector('[data-properties-panel]') as HTMLElement
              if (panel) {
                const rect = panel.getBoundingClientRect()
                setVariablePickerPosition({ x: rect.left - 400, y: rect.top })
              }
            }}
            onSavedBlocksUpdate={async () => {
              try {
                const response = await fetch('/api/marketing/content-blocks')
                if (response.ok) {
                  const data = await response.json()
                  setSavedBlocks(data.blocks || [])
                }
              } catch (error) {
                console.error('Failed to reload saved blocks:', error)
              }
            }}
          />
              }
              setShowVariablePicker(!showVariablePicker)
            }}
          />
          {showVariablePicker && variablePickerPosition && (
            <div
              style={{
                position: 'fixed',
                left: `${variablePickerPosition.x}px`,
                top: `${variablePickerPosition.y}px`,
              }}
            >
              <VariablePicker
                onSelect={(variable) => {
                  if (selectedBlockData?.type === 'text') {
                    const currentContent = selectedBlockData.content || ''
                    const newContent = currentContent + `{{${variable}}}`
                    updateBlock({ content: newContent })
                  }
                  setShowVariablePicker(false)
                }}
                onClose={() => setShowVariablePicker(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

// Block Palette Component
function BlockPalette({ 
  onDragStart,
  onAddSavedBlock,
  savedBlocks = [],
}: { 
  onDragStart: (type: string) => void
  onAddSavedBlock?: (block: any) => void
  savedBlocks?: Array<{ id: string; name: string; category?: string }>
}) {
  const [activeTab, setActiveTab] = useState<'blocks' | 'saved'>('blocks')
  
  const blocks = [
    { type: 'header', label: 'Header', icon: Type, category: 'structure' },
    { type: 'text', label: 'Text', icon: Type, category: 'content' },
    { type: 'image', label: 'Image', icon: ImageIcon, category: 'media' },
    { type: 'button', label: 'Button', icon: Square, category: 'cta' },
    { type: 'divider', label: 'Divider', icon: Minus, category: 'structure' },
    { type: 'spacer', label: 'Spacer', icon: ArrowUpDown, category: 'structure' },
    { type: 'footer', label: 'Footer', icon: Type, category: 'structure' },
    { type: 'social', label: 'Social Links', icon: Share2, category: 'social' },
    { type: 'video', label: 'Video', icon: Play, category: 'media' },
    { type: 'html', label: 'HTML Code', icon: FileCode, category: 'advanced' },
    { type: 'product', label: 'Product', icon: Package, category: 'content' },
  ]
  
  const blocksByCategory = blocks.reduce((acc, block) => {
    const cat = block.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(block)
    return acc
  }, {} as Record<string, typeof blocks>)

  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-900">Content Blocks</h3>
        <p className="text-xs text-gray-500 mt-1">Drag to add</p>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('blocks')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'blocks'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Blocks
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'saved'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Saved ({savedBlocks.length})
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'blocks' ? (
          <div className="space-y-4">
            {Object.entries(blocksByCategory).map(([category, categoryBlocks]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                  {category}
                </h4>
                <div className="space-y-1">
                  {categoryBlocks.map((block) => {
                    const Icon = block.icon
                    return (
                      <div
                        key={block.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('blockType', block.type)
                          onDragStart(block.type)
                        }}
                        className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-move transition-colors"
                      >
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{block.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {savedBlocks.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                <Library className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No saved blocks yet</p>
                <p className="text-xs mt-1">Save blocks to reuse them</p>
              </div>
            ) : (
              savedBlocks.map((block) => (
                <div
                  key={block.id}
                  onClick={() => onAddSavedBlock?.(block)}
                  className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                >
                  <Layers className="h-4 w-4 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{block.name}</p>
                    {block.category && (
                      <p className="text-xs text-gray-500">{block.category}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Canvas Component
function Canvas({
  doc,
  selectedBlock,
  selectedRow,
  onSelectBlock,
  onSelectRow,
  onDeleteBlock,
  onDuplicateBlock,
  onAddRow,
  onDeleteRow,
  onDuplicateRow,
  onChangeColumnLayout,
  brandProfile,
  showVariablePicker,
  onInsertVariable,
  onPaletteDrop,
  onPaletteDragOver,
}: {
  doc: EmailDoc
  selectedBlock: { rowId: string; colId: string; blockIndex: number } | null
  selectedRow: string | null
  onSelectBlock: (rowId: string, colId: string, blockIndex: number) => void
  onSelectRow: (rowId: string) => void
  onDeleteBlock: () => void
  onDuplicateBlock: () => void
  onAddRow: (columnCount: 1 | 2 | 3 | 4) => void
  onDeleteRow: (rowId: string) => void
  onDuplicateRow: (rowId: string) => void
  onChangeColumnLayout: (rowId: string, columnCount: 1 | 2 | 3 | 4) => void
  brandProfile?: any
  showVariablePicker: boolean
  onInsertVariable: (variable: string) => void
  onPaletteDrop: (e: React.DragEvent, rowId: string, colId: string) => void
  onPaletteDragOver: (e: React.DragEvent) => void
}) {

  return (
    <div className="relative">
      {/* Add Row Buttons */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Add Section:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddRow(1)}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          1 Column
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddRow(2)}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          2 Columns
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddRow(3)}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          3 Columns
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddRow(4)}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          4 Columns
        </Button>
      </div>

      {doc.rows.map((row, rowIndex) => (
        <RowComponent
          key={row.id || `row-${rowIndex}`}
          row={row}
          rowId={row.id || `row-${rowIndex}`}
          isSelected={selectedRow === row.id}
          onSelect={() => onSelectRow(row.id || `row-${rowIndex}`)}
          onDrop={onPaletteDrop}
          onDragOver={onPaletteDragOver}
          selectedBlock={selectedBlock}
          onSelectBlock={onSelectBlock}
          onDeleteBlock={onDeleteBlock}
          onDuplicateBlock={onDuplicateBlock}
          onDeleteRow={onDeleteRow}
          onDuplicateRow={onDuplicateRow}
          onChangeColumnLayout={onChangeColumnLayout}
          brandProfile={brandProfile}
          showVariablePicker={showVariablePicker}
          onInsertVariable={onInsertVariable}
        />
      ))}
      {doc.rows.length === 0 && (
        <div
          className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg m-4"
          onDrop={(e) => {
            e.preventDefault()
            const blockType = e.dataTransfer.getData('blockType')
            if (blockType) {
              // Add first row if none exists
              const newRowId = 'row-1'
              const newColId = 'col-1'
              onPaletteDrop(e, newRowId, newColId)
            }
          }}
          onDragOver={onPaletteDragOver}
        >
          <p className="text-sm">Drag blocks here to start building</p>
        </div>
      )}
    </div>
  )
}

// Row Component
function RowComponent({
  row,
  rowId,
  isSelected,
  onSelect,
  onDrop,
  onDragOver,
  selectedBlock,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onDeleteRow,
  onDuplicateRow,
  onChangeColumnLayout,
  brandProfile,
  showVariablePicker,
  onInsertVariable,
}: {
  row: Row
  rowId: string
  isSelected: boolean
  onSelect: () => void
  onDrop: (e: React.DragEvent, rowId: string, colId: string) => void
  onDragOver: (e: React.DragEvent) => void
  selectedBlock: { rowId: string; colId: string; blockIndex: number } | null
  onSelectBlock: (rowId: string, colId: string, blockIndex: number) => void
  onDeleteBlock: () => void
  onDuplicateBlock: () => void
  onDeleteRow: (rowId: string) => void
  onDuplicateRow: (rowId: string) => void
  onChangeColumnLayout: (rowId: string, columnCount: 1 | 2 | 3 | 4) => void
  brandProfile?: any
  showVariablePicker: boolean
  onInsertVariable: (variable: string) => void
}) {
  const rowStyle = row.style || {}
  const backgroundStyle: React.CSSProperties = {
    backgroundColor: rowStyle.backgroundColor,
    backgroundImage: rowStyle.backgroundImage ? `url(${rowStyle.backgroundImage})` : undefined,
    backgroundSize: rowStyle.backgroundSize || 'cover',
    backgroundPosition: rowStyle.backgroundPosition || 'center',
    padding: rowStyle.padding,
    margin: rowStyle.margin,
  }

  return (
    <div
      className={`relative border-2 rounded-lg mb-2 ${
        isSelected ? 'border-blue-500' : 'border-transparent'
      }`}
      style={backgroundStyle}
      onClick={onSelect}
    >
      {/* Overlay for background images to ensure content is readable */}
      {rowStyle.backgroundImage && (
        <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg pointer-events-none" />
      )}
      <div className={`relative ${rowStyle.backgroundImage ? 'bg-white bg-opacity-90' : ''}`}>
      {/* Row Controls */}
      {isSelected && (
        <div className="absolute -left-32 top-2 flex flex-col items-center gap-1 z-10">
          <button
            className="p-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
            title="Duplicate Section"
            onClick={(e) => {
              e.stopPropagation()
              onDuplicateRow(rowId)
            }}
          >
            <DuplicateIcon className="h-4 w-4 text-gray-600" />
          </button>
          <button
            className="p-1 bg-white border border-red-300 rounded shadow-sm hover:bg-red-50"
            title="Delete Section"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Delete this section? All blocks in it will be removed.')) {
                onDeleteRow(rowId)
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
          <div className="border-t border-gray-300 my-1 w-6" />
          <div className="p-1 bg-white border border-gray-300 rounded shadow-sm">
            <Select
              value={String(row.columns.length)}
              onValueChange={(value) => onChangeColumnLayout(rowId, parseInt(value) as 1 | 2 | 3 | 4)}
            >
              <SelectTrigger className="h-6 w-12 text-xs p-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Col</SelectItem>
                <SelectItem value="2">2 Col</SelectItem>
                <SelectItem value="3">3 Col</SelectItem>
                <SelectItem value="4">4 Col</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <div className="absolute -left-8 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100">
        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
      </div>
      {row.columns.map((col, colIndex) => (
        <ColumnComponent
          key={col.id || `col-${colIndex}`}
          column={col}
          rowId={rowId}
          colId={col.id || `col-${colIndex}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          selectedBlock={selectedBlock}
          onSelectBlock={onSelectBlock}
          onDeleteBlock={onDeleteBlock}
          onDuplicateBlock={onDuplicateBlock}
          brandProfile={brandProfile}
          showVariablePicker={showVariablePicker}
          onInsertVariable={onInsertVariable}
        />
      ))}
      </div>
    </div>
  )
}

// Column Component
function ColumnComponent({
  column,
  rowId,
  colId,
  onDrop,
  onDragOver,
  selectedBlock,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  brandProfile,
  showVariablePicker,
  onInsertVariable,
}: {
  column: Column
  rowId: string
  colId: string
  onDrop: (e: React.DragEvent, rowId: string, colId: string) => void
  onDragOver: (e: React.DragEvent) => void
  selectedBlock: { rowId: string; colId: string; blockIndex: number } | null
  onSelectBlock: (rowId: string, colId: string, blockIndex: number) => void
  onDeleteBlock: () => void
  onDuplicateBlock: () => void
  brandProfile?: any
  showVariablePicker: boolean
  onInsertVariable: (variable: string) => void
}) {
  return (
    <div
      className="min-h-[100px] p-2"
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const blockType = e.dataTransfer.getData('blockType')
        if (blockType) {
          onDrop(e, rowId, colId)
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragOver(e)
      }}
    >
      <SortableContext 
        items={column.blocks.map((_, idx) => `block-${rowId}-${colId}-${idx}`)} 
        strategy={verticalListSortingStrategy}
      >
        {column.blocks.map((block, blockIndex) => {
          const isSelected =
            selectedBlock?.rowId === rowId &&
            selectedBlock?.colId === colId &&
            selectedBlock?.blockIndex === blockIndex

          return (
            <BlockComponent
              key={`block-${rowId}-${colId}-${blockIndex}`}
              block={block}
              rowId={rowId}
              colId={colId}
              blockIndex={blockIndex}
              isSelected={isSelected}
              onSelect={() => onSelectBlock(rowId, colId, blockIndex)}
              onDelete={onDeleteBlock}
              onDuplicate={onDuplicateBlock}
              brandProfile={brandProfile}
              showVariablePicker={showVariablePicker}
              onInsertVariable={onInsertVariable}
            />
          )
        })}
      </SortableContext>
      {column.blocks.length === 0 && (
        <div
          className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg"
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const blockType = e.dataTransfer.getData('blockType')
            if (blockType) {
              onDrop(e, rowId, colId)
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDragOver(e)
          }}
        >
          <p className="text-sm">Drop blocks here</p>
        </div>
      )}
    </div>
  )
}

// Block Component (will continue in next part due to length)
function BlockComponent({
  block,
  rowId,
  colId,
  blockIndex,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  brandProfile,
  showVariablePicker,
  onInsertVariable,
}: {
  block: Block
  rowId: string
  colId: string
  blockIndex: number
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  brandProfile?: any
  showVariablePicker: boolean
  onInsertVariable: (variable: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `block-${rowId}-${colId}-${blockIndex}`,
    data: {
      rowId,
      colId,
      blockIndex,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative group mb-2 ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-300'
      } rounded-lg transition-all`}
      onClick={onSelect}
    >
      {isSelected && (
        <div className="absolute -left-8 top-0 flex items-center gap-1 z-10">
          <button
            {...listeners}
            className="p-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            className="p-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
            title="Duplicate"
          >
            <Copy className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 bg-white border border-red-300 rounded shadow-sm hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
        </div>
      )}
      <BlockRenderer
        block={block}
        isSelected={isSelected}
        brandProfile={brandProfile}
        showVariablePicker={showVariablePicker}
        onInsertVariable={onInsertVariable}
      />
    </div>
  )
}

// Block Renderer (will render different block types)
function BlockRenderer({
  block,
  isSelected,
  brandProfile,
  showVariablePicker,
  onInsertVariable,
}: {
  block: Block
  isSelected: boolean
  brandProfile?: any
  showVariablePicker: boolean
  onInsertVariable: (variable: string) => void
}) {
  switch (block.type) {
    case 'header':
      return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded">
          <div className="flex items-center gap-3">
            {brandProfile?.logoUrl && (
              <img src={brandProfile.logoUrl} alt="Logo" className="h-10" />
            )}
            <div>
              <div className="font-semibold text-gray-900">
                {brandProfile?.practiceName || block.content || 'Practice Name'}
              </div>
            </div>
          </div>
        </div>
      )
    case 'text':
      // Render text block - editor is handled in parent
      return (
        <div
          className="prose prose-sm max-w-none p-4"
          dangerouslySetInnerHTML={{ __html: block.content || '<p>Enter text here...</p>' }}
        />
      )
    case 'image':
      return (
        <div className="p-4">
          {block.url ? (
            <img
              src={block.url}
              alt={block.alt || 'Image'}
              className={`max-w-full h-auto ${
                block.style?.align === 'center' ? 'mx-auto' : ''
              }`}
            />
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
              <ImageIcon className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Click to add image</p>
            </div>
          )}
        </div>
      )
    case 'button':
      return (
        <div className="p-4 text-center">
          <a
            href={block.url || '#'}
            className="inline-block px-6 py-3 rounded text-white font-medium no-underline"
            style={{
              backgroundColor: block.style?.backgroundColor || '#2563eb',
              color: block.style?.textColor || '#ffffff',
              borderRadius: block.style?.borderRadius || '6px',
            }}
          >
            {block.label || 'Click Here'}
          </a>
        </div>
      )
    case 'divider':
      return (
        <div className="p-4">
          <hr
            style={{
              borderColor: block.style?.color || '#e5e7eb',
              borderWidth: block.style?.thickness || '1px',
              borderStyle: 'solid',
            }}
          />
        </div>
      )
    case 'spacer':
      return (
        <div
          style={{
            height: block.height || '20px',
          }}
        />
      )
    case 'footer':
      return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
          {brandProfile?.emailFooterHtml ? (
            <div dangerouslySetInnerHTML={{ __html: brandProfile.emailFooterHtml }} />
          ) : (
            <div>
              <p>{brandProfile?.practiceName || 'Practice Name'}</p>
              <p>{brandProfile?.defaultFromEmail || 'contact@practice.com'}</p>
              {block.showUnsubscribe && (
                <p>
                  <a href="#" className="text-blue-600">
                    Unsubscribe
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      )
    case 'social':
      return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded">
          <div className="flex items-center justify-center gap-4">
            {block.links?.map((link, idx) => (
              <a
                key={idx}
                href={link.url || '#'}
                className="text-gray-600 hover:text-gray-900"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.platform === 'facebook' && '📘'}
                {link.platform === 'twitter' && '🐦'}
                {link.platform === 'instagram' && '📷'}
                {link.platform === 'linkedin' && '💼'}
                {link.platform === 'youtube' && '📺'}
                {link.platform === 'custom' && '🔗'}
              </a>
            ))}
          </div>
        </div>
      )
    case 'video':
      return (
        <div className="p-4">
          {block.url ? (
            <div className="relative aspect-video bg-gray-100 rounded border border-gray-200">
              {block.thumbnail ? (
                <img src={block.thumbnail} alt={block.alt || 'Video'} className="w-full h-full object-cover rounded" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Play className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-300 rounded">
              <Play className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Add video URL</p>
            </div>
          )}
        </div>
      )
    case 'html':
      return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded">
          <div className="flex items-center gap-2 mb-2">
            <Code className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-700">HTML Code</span>
          </div>
          <div className="text-xs text-gray-600 font-mono bg-white p-2 rounded border border-gray-200 max-h-32 overflow-auto">
            {block.content || '<!-- Add HTML code -->'}
          </div>
        </div>
      )
    case 'product':
      return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded">
          <div className={`flex gap-4 ${block.style?.layout === 'vertical' ? 'flex-col' : 'flex-row'}`}>
            {block.imageUrl && (
              <img
                src={block.imageUrl}
                alt={block.name}
                className={`${block.style?.layout === 'vertical' ? 'w-full' : 'w-32'} h-32 object-cover rounded`}
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{block.name}</h3>
              {block.description && <p className="text-sm text-gray-600 mt-1">{block.description}</p>}
              {block.price && <p className="text-lg font-bold text-gray-900 mt-2">{block.price}</p>}
              {block.buttonLabel && (
                <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded text-sm">
                  {block.buttonLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )
    default:
      return <div className="p-4">Unknown block type</div>
  }
}

// Properties Panel Component (continued in next message due to length)
function PropertiesPanel({
  block,
  doc,
  onUpdate,
  onDelete,
  onDuplicate,
  brandProfile,
  onShowVariablePicker,
  onSavedBlocksUpdate,
}: {
  block: Block | undefined
  doc: EmailDoc
  onUpdate: (updates: Partial<Block>) => void
  onDelete: () => void
  onDuplicate: () => void
  brandProfile?: any
  onShowVariablePicker: () => void
  onSavedBlocksUpdate?: () => Promise<void>
}) {
  if (!block) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto p-4">
        <div className="text-sm text-gray-500 text-center mt-8">
          Select a block to edit its properties
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto" data-properties-panel>
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-900 capitalize">{block.type} Properties</h3>
      </div>
      <div className="p-4 space-y-4">
        {block.type === 'text' && (
          <>
            <div>
              <Label className="text-xs text-gray-600">Content</Label>
              <div className="mt-1">
                <ReactQuill
                  theme="snow"
                  value={block.content || ''}
                  onChange={(value) => {
                    onUpdate({ content: value })
                  }}
                  placeholder="Enter text here..."
                  modules={{
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ list: 'ordered' }, { list: 'bullet' }],
                      [{ align: [] }],
                      ['link'],
                      ['clean'],
                    ],
                  }}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onShowVariablePicker}
                  className="w-full text-xs mt-2"
                >
                  <Code className="h-3 w-3 mr-2" />
                  Insert Variable
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Font Size</Label>
              <Select
                value={block.style?.fontSize || '16px'}
                onValueChange={(value) => onUpdate({ style: { ...block.style, fontSize: value } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12px">12px</SelectItem>
                  <SelectItem value="14px">14px</SelectItem>
                  <SelectItem value="16px">16px</SelectItem>
                  <SelectItem value="18px">18px</SelectItem>
                  <SelectItem value="20px">20px</SelectItem>
                  <SelectItem value="24px">24px</SelectItem>
                  <SelectItem value="32px">32px</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Text Color</Label>
              <Input
                type="color"
                value={block.style?.color || '#333333'}
                onChange={(e) => onUpdate({ style: { ...block.style, color: e.target.value } })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Text Align</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={block.style?.textAlign === 'left' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate({ style: { ...block.style, textAlign: 'left' } })}
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={block.style?.textAlign === 'center' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate({ style: { ...block.style, textAlign: 'center' } })}
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant={block.style?.textAlign === 'right' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate({ style: { ...block.style, textAlign: 'right' } })}
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Padding</Label>
              <Input
                type="text"
                value={block.style?.padding || '20px'}
                onChange={(e) => onUpdate({ style: { ...block.style, padding: e.target.value } })}
                placeholder="20px"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {block.type === 'image' && (
          <>
            <div>
              <Label className="text-xs text-gray-600">Upload Image</Label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    // Create FormData and upload to /api/marketing/assets
                    const formData = new FormData()
                    formData.append('file', file)
                    formData.append('type', 'image')
                    
                    try {
                      const response = await fetch('/api/marketing/assets', {
                        method: 'POST',
                        body: formData,
                      })
                      
                      if (response.ok) {
                        const data = await response.json()
                        onUpdate({ url: data.asset.url })
                      } else {
                        alert('Failed to upload image')
                      }
                    } catch (error) {
                      alert('Failed to upload image')
                    }
                  }
                }}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Or Image URL</Label>
              <Input
                type="url"
                value={block.url || ''}
                onChange={(e) => onUpdate({ url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Alt Text</Label>
              <Input
                type="text"
                value={block.alt || ''}
                onChange={(e) => onUpdate({ alt: e.target.value })}
                placeholder="Image description"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Link URL (optional)</Label>
              <Input
                type="url"
                value={block.link || ''}
                onChange={(e) => onUpdate({ link: e.target.value })}
                placeholder="https://example.com"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Alignment</Label>
              <Select
                value={block.style?.align || 'center'}
                onValueChange={(value: any) => onUpdate({ style: { ...block.style, align: value } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {block.type === 'button' && (
          <>
            <div>
              <Label className="text-xs text-gray-600">Button Label</Label>
              <Input
                type="text"
                value={block.label || ''}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="Click Here"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Button URL</Label>
              <Input
                type="url"
                value={block.url || ''}
                onChange={(e) => onUpdate({ url: e.target.value })}
                placeholder="https://example.com"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Background Color</Label>
              <Input
                type="color"
                value={block.style?.backgroundColor || '#2563eb'}
                onChange={(e) =>
                  onUpdate({ style: { ...block.style, backgroundColor: e.target.value } })
                }
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Text Color</Label>
              <Input
                type="color"
                value={block.style?.textColor || '#ffffff'}
                onChange={(e) => onUpdate({ style: { ...block.style, textColor: e.target.value } })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Border Radius</Label>
              <Input
                type="text"
                value={block.style?.borderRadius || '6px'}
                onChange={(e) =>
                  onUpdate({ style: { ...block.style, borderRadius: e.target.value } })
                }
                placeholder="6px"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Padding</Label>
              <Input
                type="text"
                value={block.style?.padding || '12px 24px'}
                onChange={(e) => onUpdate({ style: { ...block.style, padding: e.target.value } })}
                placeholder="12px 24px"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {block.type === 'divider' && (
          <>
            <div>
              <Label className="text-xs text-gray-600">Color</Label>
              <Input
                type="color"
                value={block.style?.color || '#e5e7eb'}
                onChange={(e) => onUpdate({ style: { ...block.style, color: e.target.value } })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Thickness</Label>
              <Input
                type="text"
                value={block.style?.thickness || '1px'}
                onChange={(e) => onUpdate({ style: { ...block.style, thickness: e.target.value } })}
                placeholder="1px"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {block.type === 'spacer' && (
          <>
            <div>
              <Label className="text-xs text-gray-600">Height</Label>
              <Input
                type="text"
                value={block.height || '20px'}
                onChange={(e) => onUpdate({ height: e.target.value })}
                placeholder="20px"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        <div className="pt-4 border-t border-gray-200 space-y-2">
          <Button variant="outline" size="sm" onClick={onDuplicate} className="w-full">
            <Copy className="h-3 w-3 mr-2" />
            Duplicate Block
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={async () => {
              // Save block to content library
              const name = prompt('Enter a name for this block:')
              if (name) {
                try {
                  const response = await fetch('/api/marketing/content-blocks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name,
                      blockData: block,
                      blockType: 'block',
                      category: 'custom',
                    }),
                  })
                  if (response.ok) {
                    alert('Block saved to library!')
                    // Reload saved blocks
                    const blocksResponse = await fetch('/api/marketing/content-blocks')
                    if (blocksResponse.ok) {
                      if (onSavedBlocksUpdate) {
                        onSavedBlocksUpdate()
                      }
                    }
                  }
                } catch (error) {
                  console.error('Failed to save block:', error)
                  alert('Failed to save block')
                }
              }
            }}
            className="w-full"
          >
            <Library className="h-3 w-3 mr-2" />
            Save to Library
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete} className="w-full">
            <Trash2 className="h-3 w-3 mr-2" />
            Delete Block
          </Button>
        </div>
      </div>
    </div>
  )
}

EmailBuilder.displayName = 'EmailBuilder'

export default EmailBuilder
