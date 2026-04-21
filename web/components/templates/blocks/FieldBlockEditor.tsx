'use client'

import React from 'react'
import type { FieldBlock, BoardColumnMeta } from '@/lib/document-blocks'

interface FieldBlockEditorProps {
  block: FieldBlock
  onChange: (patch: Partial<FieldBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function FieldBlockEditor({
  block,
  onChange,
  availableColumns,
}: FieldBlockEditorProps) {
  return (
    <div className="space-y-3">
      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Columna</span>
        <select
          value={block.col_key}
          onChange={(e) => onChange({ col_key: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="">-- Selecciona una columna --</option>
          {availableColumns.map((col) => (
            <option key={col.col_key} value={col.col_key}>
              {col.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Etiqueta personalizada (opcional)</span>
        <input
          type="text"
          value={block.label || ''}
          onChange={(e) => onChange({ label: e.target.value || undefined })}
          placeholder="Ej: Mi columna personalizada"
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <div>
        <span className="block text-xs font-medium text-gray-700 mb-2">Disposición</span>
        <div className="flex gap-2">
          {(['inline', 'stacked'] as const).map((layout) => (
            <button
              key={layout}
              onClick={() => onChange({ layout })}
              className={`px-3 py-1 rounded text-sm font-medium ${
                block.layout === layout
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {layout === 'inline' ? '➡️ Inline' : '⬇️ Apilado'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
