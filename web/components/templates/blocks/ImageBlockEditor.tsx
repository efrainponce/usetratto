'use client'

import React from 'react'
import type { ImageBlock, BoardColumnMeta } from '@/lib/document-blocks'

interface ImageBlockEditorProps {
  block: ImageBlock
  onChange: (patch: Partial<ImageBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function ImageBlockEditor({
  block,
  onChange,
  availableColumns,
}: ImageBlockEditorProps) {
  const fileColumns = availableColumns.filter((col) => {
    const kind = col.kind as string
    return kind === 'file' || kind === 'url' || kind === 'button'
  })

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-xs font-medium text-gray-700 mb-2">Fuente</span>
        <div className="flex gap-2">
          {(['url', 'col'] as const).map((source) => (
            <button
              key={source}
              onClick={() => onChange({ source, col_key: undefined, url: '' })}
              className={`px-3 py-1 rounded text-sm font-medium ${
                block.source === source
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {source === 'url' ? '🔗 URL' : '📋 Columna'}
            </button>
          ))}
        </div>
      </div>

      {block.source === 'url' && (
        <label>
          <span className="block text-xs font-medium text-gray-700 mb-1">URL de imagen</span>
          <input
            type="text"
            value={block.url || ''}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://..."
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
      )}

      {block.source === 'col' && (
        <label>
          <span className="block text-xs font-medium text-gray-700 mb-1">Columna de archivo</span>
          <select
            value={block.col_key || ''}
            onChange={(e) => onChange({ col_key: e.target.value })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="">-- Selecciona una columna --</option>
            {fileColumns.map((col) => (
              <option key={col.col_key} value={col.col_key}>
                {col.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="block text-xs font-medium text-gray-700 mb-1">Ancho (px)</span>
          <input
            type="number"
            value={block.width || 200}
            onChange={(e) => onChange({ width: parseInt(e.target.value) })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="flex-1">
          <span className="block text-xs font-medium text-gray-700 mb-1">Alto (px)</span>
          <input
            type="number"
            value={block.height || 200}
            onChange={(e) => onChange({ height: parseInt(e.target.value) })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
      </div>

      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Ajuste</span>
        <select
          value={block.fit || 'contain'}
          onChange={(e) => onChange({ fit: e.target.value as 'contain' | 'cover' })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="contain">Contener</option>
          <option value="cover">Cubrir</option>
        </select>
      </label>

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
    </div>
  )
}
