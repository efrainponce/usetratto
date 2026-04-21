'use client'

import React from 'react'
import type {
  Block,
  HeadingBlock,
  TextBlock,
  FieldBlock,
  ImageBlock,
  ColumnsBlock,
  SpacerBlock,
  DividerBlock,
  RepeatBlock,
  SubitemsTableBlock,
  TotalBlock,
  SignatureBlock,
} from '@/lib/document-blocks'

interface BlockPaletteProps {
  onAdd: (block: Block) => void
}

function generateId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }
  // Fallback for non-browser environments
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function BlockPalette({ onAdd }: BlockPaletteProps) {
  const buttons = [
    {
      label: 'Heading',
      emoji: '📝',
      onClick: () => {
        const block: HeadingBlock = {
          id: generateId(),
          type: 'heading',
          level: 2,
          text: 'Título',
        }
        onAdd(block)
      },
    },
    {
      label: 'Text',
      emoji: '📄',
      onClick: () => {
        const block: TextBlock = {
          id: generateId(),
          type: 'text',
          content: 'Escribe aquí...',
        }
        onAdd(block)
      },
    },
    {
      label: 'Field',
      emoji: '🏷️',
      onClick: () => {
        const block: FieldBlock = {
          id: generateId(),
          type: 'field',
          col_key: '',
        }
        onAdd(block)
      },
    },
    {
      label: 'Image',
      emoji: '🖼️',
      onClick: () => {
        const block: ImageBlock = {
          id: generateId(),
          type: 'image',
          source: 'url',
          url: '',
          width: 200,
        }
        onAdd(block)
      },
    },
    {
      label: 'Columns',
      emoji: '📊',
      onClick: () => {
        const block: ColumnsBlock = {
          id: generateId(),
          type: 'columns',
          children: [
            { width: '50%', blocks: [] },
            { width: '50%', blocks: [] },
          ],
        }
        onAdd(block)
      },
    },
    {
      label: 'Spacer',
      emoji: '⬆️',
      onClick: () => {
        const block: SpacerBlock = {
          id: generateId(),
          type: 'spacer',
          height: 24,
        }
        onAdd(block)
      },
    },
    {
      label: 'Divider',
      emoji: '─',
      onClick: () => {
        const block: DividerBlock = {
          id: generateId(),
          type: 'divider',
        }
        onAdd(block)
      },
    },
    {
      label: 'Repeat',
      emoji: '🔁',
      onClick: () => {
        const block: RepeatBlock = {
          id: generateId(),
          type: 'repeat',
          source: 'sub_items',
          blocks: [],
        }
        onAdd(block)
      },
    },
    {
      label: 'Subitems Table',
      emoji: '📋',
      onClick: () => {
        const block: SubitemsTableBlock = {
          id: generateId(),
          type: 'subitems_table',
          columns: [],
        }
        onAdd(block)
      },
    },
    {
      label: 'Total',
      emoji: '∑',
      onClick: () => {
        const block: TotalBlock = {
          id: generateId(),
          type: 'total',
          source: 'static',
          value: 0,
        }
        onAdd(block)
      },
    },
    {
      label: 'Signature',
      emoji: '✍️',
      onClick: () => {
        const block: SignatureBlock = {
          id: generateId(),
          type: 'signature',
          role: 'cliente',
          required: true,
        }
        onAdd(block)
      },
    },
  ]

  return (
    <div className="w-full max-w-xs bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Bloques</h3>
      <div className="space-y-2">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md border border-gray-200 text-sm font-medium text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 transition"
          >
            <span className="text-lg">{btn.emoji}</span>
            <span>{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
