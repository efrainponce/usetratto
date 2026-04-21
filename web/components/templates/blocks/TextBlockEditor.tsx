'use client'

import React, { useRef } from 'react'
import type { TextBlock, BoardColumnMeta } from '@/lib/document-blocks'
import { useSlashMenu, SlashMenu } from '../SlashMenu'

interface TextBlockEditorProps {
  block: TextBlock
  onChange: (patch: Partial<TextBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function TextBlockEditor({
  block,
  onChange,
  availableColumns,
}: TextBlockEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { showMenu, onSelect, onClose } = useSlashMenu(textareaRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, availableColumns, () => {})

  return (
    <div className="space-y-3">
      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Contenido</span>
        <textarea
          ref={textareaRef}
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Escribe aquí... (Usa / para insertar columnas)"
          rows={4}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
        />
      </label>

      <div>
        <span className="block text-xs font-medium text-gray-700 mb-2">Alineación</span>
        <div className="flex gap-2">
          {(['left', 'center', 'right', 'justify'] as const).map((align) => (
            <button
              key={align}
              onClick={() => onChange({ align })}
              className={`px-3 py-1 rounded text-sm font-medium ${
                block.align === align
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {align === 'left'
                ? '⬅️'
                : align === 'center'
                  ? '⬇️'
                  : align === 'right'
                    ? '➡️'
                    : '⬌'}
            </button>
          ))}
        </div>
      </div>

      {showMenu && (
        <SlashMenu
          columns={availableColumns}
          onSelect={onSelect}
          onClose={onClose}
          triggerRef={textareaRef as React.RefObject<HTMLElement>}
        />
      )}
    </div>
  )
}
