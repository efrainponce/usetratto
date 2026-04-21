'use client'

import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { Block, BoardColumnMeta } from '@/lib/document-blocks'

import {
  HeadingBlockEditor,
  TextBlockEditor,
  FieldBlockEditor,
  ImageBlockEditor,
  ColumnsBlockEditor,
  SpacerBlockEditor,
  DividerBlockEditor,
  RepeatBlockEditor,
  SubitemsTableBlockEditor,
  TotalBlockEditor,
  SignatureBlockEditor,
} from './blocks'

interface BlockCanvasProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

// Internal component to render each sortable block
function SortableBlock({
  block,
  onUpdate,
  onDelete,
  availableColumns,
  subItemColumns,
}: {
  block: Block
  onUpdate: (patch: Partial<Block>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: block.id,
  })
  const [isExpanded, setIsExpanded] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const dragStyle = {
    cursor: 'grab',
    touchAction: 'none',
  }

  const blockLabel = {
    heading: `Heading (H${(block as any).level || 2})`,
    text: 'Text',
    field: 'Field',
    image: 'Image',
    columns: 'Columns',
    spacer: 'Spacer',
    divider: 'Divider',
    repeat: 'Repeat',
    subitems_table: 'Subitems Table',
    total: 'Total',
    signature: 'Signature',
  }[block.type] || 'Block'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative mb-4 border border-gray-200 rounded-md bg-white hover:border-indigo-400 hover:bg-indigo-50/30 transition"
    >
      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute -top-2 -right-2 hidden group-hover:block w-6 h-6 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600 z-10"
        title="Delete block"
      >
        ×
      </button>

      {/* Header with drag handle */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50">
        <button
          {...listeners}
          {...attributes}
          style={dragStyle}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1"
          title="Drag to reorder"
        >
          ☰
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 text-left text-sm font-medium text-gray-700 hover:text-indigo-600"
        >
          {blockLabel}
        </button>
      </div>

      {/* Editor form */}
      {isExpanded && (
        <div className="p-4 bg-white">
          <BlockEditorDispatcher
            block={block}
            onChange={onUpdate}
            onDelete={onDelete}
            availableColumns={availableColumns}
            subItemColumns={subItemColumns}
          />
        </div>
      )}
    </div>
  )
}

// Dispatcher component to select the right editor based on block type
function BlockEditorDispatcher({
  block,
  onChange,
  onDelete,
  availableColumns,
  subItemColumns,
}: {
  block: Block
  onChange: (patch: Partial<Block>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}) {
  switch (block.type) {
    case 'heading':
      return (
        <HeadingBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'text':
      return (
        <TextBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'field':
      return (
        <FieldBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'image':
      return (
        <ImageBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'columns':
      return (
        <ColumnsBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'spacer':
      return (
        <SpacerBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'divider':
      return (
        <DividerBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'repeat':
      return (
        <RepeatBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'subitems_table':
      return (
        <SubitemsTableBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'total':
      return (
        <TotalBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    case 'signature':
      return (
        <SignatureBlockEditor
          block={block as any}
          onChange={onChange}
          onDelete={onDelete}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      )
    default:
      return <div className="text-red-500 text-sm">Unknown block type</div>
  }
}

export function BlockCanvas({
  blocks,
  onChange,
  availableColumns,
  subItemColumns,
}: BlockCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id)
      const newIndex = blocks.findIndex((b) => b.id === over.id)
      const newBlocks = arrayMove(blocks, oldIndex, newIndex)
      onChange(newBlocks)
    }
  }

  const handleUpdateBlock = (blockId: string, patch: Partial<Block>) => {
    const newBlocks = blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b))
    onChange(newBlocks)
  }

  const handleDeleteBlock = (blockId: string) => {
    const newBlocks = blocks.filter((b) => b.id !== blockId)
    onChange(newBlocks)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {blocks.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No blocks yet. Use the palette to add one.
            </div>
          )}
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              onUpdate={(patch) => handleUpdateBlock(block.id, patch)}
              onDelete={() => handleDeleteBlock(block.id)}
              availableColumns={availableColumns}
              subItemColumns={subItemColumns}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
