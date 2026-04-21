'use client'

import React from 'react'
import type { RepeatBlock, BoardColumnMeta } from '@/lib/document-blocks'
import { BlockCanvas } from '../BlockCanvas'

interface RepeatBlockEditorProps {
  block: RepeatBlock
  onChange: (patch: Partial<RepeatBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function RepeatBlockEditor({
  block,
  onChange,
  availableColumns,
  subItemColumns,
}: RepeatBlockEditorProps) {
  const relationColumns = availableColumns.filter((col) => col.kind === 'relation')

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-xs font-medium text-gray-700 mb-2">Fuente</span>
        <div className="flex gap-2">
          {(['sub_items', 'relation'] as const).map((source) => (
            <button
              key={source}
              onClick={() => onChange({ source, source_col_key: undefined })}
              className={`px-3 py-1 rounded text-sm font-medium ${
                block.source === source
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {source === 'sub_items' ? '📋 Sub-items' : '🔗 Relación'}
            </button>
          ))}
        </div>
      </div>

      {block.source === 'relation' && (
        <label>
          <span className="block text-xs font-medium text-gray-700 mb-1">Columna de relación</span>
          <select
            value={block.source_col_key || ''}
            onChange={(e) => onChange({ source_col_key: e.target.value })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="">-- Selecciona una columna --</option>
            {relationColumns.map((col) => (
              <option key={col.col_key} value={col.col_key}>
                {col.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Texto vacío</span>
        <input
          type="text"
          value={block.empty_text || ''}
          onChange={(e) => onChange({ empty_text: e.target.value || undefined })}
          placeholder="Sin items..."
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
        <p className="text-xs font-medium text-gray-900 mb-2">Bloques a repetir:</p>
        <BlockCanvas
          blocks={block.blocks}
          onChange={(blocks) => onChange({ blocks })}
          availableColumns={availableColumns}
          subItemColumns={subItemColumns}
        />
      </div>
    </div>
  )
}
