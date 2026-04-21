'use client'

import React, { useRef } from 'react'
import type { HeadingBlock, BoardColumnMeta } from '@/lib/document-blocks'
import { useSlashMenu, SlashMenu } from '../SlashMenu'

interface HeadingBlockEditorProps {
  block: HeadingBlock
  onChange: (patch: Partial<HeadingBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function HeadingBlockEditor({
  block,
  onChange,
  availableColumns,
}: HeadingBlockEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { showMenu, onSelect, onClose } = useSlashMenu(inputRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, availableColumns, () => {})

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="block text-xs font-medium text-gray-700 mb-1">Texto</span>
          <input
            ref={inputRef}
            type="text"
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Escribe el título..."
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <label className="flex-1">
          <span className="block text-xs font-medium text-gray-700 mb-1">Nivel</span>
          <select
            value={block.level}
            onChange={(e) => onChange({ level: parseInt(e.target.value) as 1 | 2 | 3 })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={1}>H1 (Muy grande)</option>
            <option value={2}>H2 (Grande)</option>
            <option value={3}>H3 (Normal)</option>
          </select>
        </label>
      </div>

      <div>
        <span className="block text-xs font-medium text-gray-700 mb-2">Alineación</span>
        <div className="flex gap-2">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              onClick={() => onChange({ align })}
              className={`px-3 py-1 rounded text-sm font-medium ${
                block.align === align
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {align === 'left' ? '⬅️' : align === 'center' ? '⬇️' : '➡️'}
            </button>
          ))}
        </div>
      </div>

      {showMenu && (
        <SlashMenu
          columns={availableColumns}
          onSelect={onSelect}
          onClose={onClose}
          triggerRef={inputRef as React.RefObject<HTMLElement>}
        />
      )}
    </div>
  )
}
