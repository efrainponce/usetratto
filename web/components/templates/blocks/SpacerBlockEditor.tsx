'use client'

import React from 'react'
import type { SpacerBlock, BoardColumnMeta } from '@/lib/document-blocks'

interface SpacerBlockEditorProps {
  block: SpacerBlock
  onChange: (patch: Partial<SpacerBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function SpacerBlockEditor({
  block,
  onChange,
}: SpacerBlockEditorProps) {
  return (
    <div className="space-y-3">
      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Altura (px)</span>
        <input
          type="number"
          value={block.height}
          onChange={(e) => onChange({ height: parseInt(e.target.value) })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>
    </div>
  )
}
