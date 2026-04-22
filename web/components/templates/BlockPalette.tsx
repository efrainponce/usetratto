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
      label: 'Encabezado',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h16M4 6h16M4 18h10"/>
        </svg>
      ),
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
      label: 'Texto',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 6.1H3M21 12.1H3M15.1 18H3"/>
        </svg>
      ),
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
      label: 'Campo',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="6" rx="1"/>
          <line x1="4" y1="14" x2="20" y2="14"/>
        </svg>
      ),
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
      label: 'Imagen',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      ),
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
      label: 'Columnas',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="4" height="16" rx="1"/>
          <rect x="10" y="4" width="4" height="16" rx="1"/>
          <rect x="17" y="4" width="4" height="16" rx="1"/>
        </svg>
      ),
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
      label: 'Espacio',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
          <path d="M12 8v8"/>
        </svg>
      ),
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
      label: 'Divisor',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="12" x2="20" y2="12"/>
        </svg>
      ),
      onClick: () => {
        const block: DividerBlock = {
          id: generateId(),
          type: 'divider',
        }
        onAdd(block)
      },
    },
    {
      label: 'Repetir',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="8" height="7" rx="1"/>
          <rect x="13" y="13" width="8" height="7" rx="1"/>
          <path d="M11 9l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
        </svg>
      ),
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
      label: 'Tabla sub-items',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      ),
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
      label: 'Totales',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4v16M16 4v16M3 9h18M3 15h18"/>
        </svg>
      ),
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
      label: 'Firma',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18l2-5m0 0L8 7m-2 6l3-4m0 0L12 5"/>
        </svg>
      ),
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
    <div className="flex flex-col gap-px">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          className="flex items-center gap-2.5 w-full px-2 py-2 text-[12.5px] text-[var(--ink-2)] hover:bg-[var(--surface)] hover:text-[var(--ink)] rounded-sm transition-colors border border-transparent hover:border-[var(--border)]"
        >
          <span className="flex-none text-[var(--ink-4)]">{btn.icon}</span>
          <span className="flex-1 text-left truncate">{btn.label}</span>
        </button>
      ))}
    </div>
  )
}
