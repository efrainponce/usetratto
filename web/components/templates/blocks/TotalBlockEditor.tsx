'use client'

import React from 'react'
import type { TotalBlock, BoardColumnMeta } from '@/lib/document-blocks'

interface TotalBlockEditorProps {
  block: TotalBlock
  onChange: (patch: Partial<TotalBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function TotalBlockEditor({
  block,
  onChange,
  availableColumns,
  subItemColumns,
}: TotalBlockEditorProps) {
  const numericColumns = [...availableColumns, ...subItemColumns].filter((col) => col.kind === 'number')

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-xs font-medium text-gray-700 mb-2">Fuente</span>
        <div className="flex gap-2">
          {(['static', 'rollup', 'formula'] as const).map((source) => (
            <button
              key={source}
              onClick={() => onChange({ source, col_key: undefined, value: 0 })}
              className={`px-3 py-1 rounded text-sm font-medium ${
                block.source === source
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {source === 'static' ? '🔢 Estático' : source === 'rollup' ? '📊 Rollup' : '⚙️ Fórmula'}
            </button>
          ))}
        </div>
      </div>

      {block.source === 'static' && (
        <label>
          <span className="block text-xs font-medium text-gray-700 mb-1">Valor</span>
          <input
            type="number"
            step="0.01"
            value={block.value || 0}
            onChange={(e) => onChange({ value: parseFloat(e.target.value) })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
      )}

      {(block.source === 'rollup' || block.source === 'formula') && (
        <label>
          <span className="block text-xs font-medium text-gray-700 mb-1">Columna numérica</span>
          <select
            value={block.col_key || ''}
            onChange={(e) => onChange({ col_key: e.target.value })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="">-- Selecciona una columna --</option>
            {numericColumns.map((col) => (
              <option key={col.col_key} value={col.col_key}>
                {col.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Etiqueta</span>
        <input
          type="text"
          value={block.label || ''}
          onChange={(e) => onChange({ label: e.target.value || undefined })}
          placeholder="Total"
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Formato</span>
        <select
          value={block.format || 'number'}
          onChange={(e) => onChange({ format: e.target.value as 'money' | 'number' | 'percent' })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="number">Número</option>
          <option value="money">Dinero</option>
          <option value="percent">Porcentaje</option>
        </select>
      </label>
    </div>
  )
}
