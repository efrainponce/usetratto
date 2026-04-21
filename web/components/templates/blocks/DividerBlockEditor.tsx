'use client'

import React from 'react'
import type { DividerBlock, BoardColumnMeta } from '@/lib/document-blocks'

interface DividerBlockEditorProps {
  block: DividerBlock
  onChange: (patch: Partial<DividerBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function DividerBlockEditor({
  block,
  onChange,
}: DividerBlockEditorProps) {
  return (
    <div className="space-y-3">
      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Grosor (px)</span>
        <input
          type="number"
          value={block.thickness || 1}
          onChange={(e) => onChange({ thickness: parseInt(e.target.value) })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Color (hexadecimal)</span>
        <input
          type="text"
          value={block.color || '#e5e7eb'}
          onChange={(e) => onChange({ color: e.target.value })}
          placeholder="#000000"
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>
    </div>
  )
}
