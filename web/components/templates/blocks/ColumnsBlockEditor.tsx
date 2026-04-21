'use client'

import React from 'react'
import type { ColumnsBlock, BoardColumnMeta } from '@/lib/document-blocks'
import { BlockCanvas } from '../BlockCanvas'

interface ColumnsBlockEditorProps {
  block: ColumnsBlock
  onChange: (patch: Partial<ColumnsBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function ColumnsBlockEditor({
  block,
  onChange,
  availableColumns,
  subItemColumns,
}: ColumnsBlockEditorProps) {
  const handleUpdateChild = (index: number, blocks: any[]) => {
    const newChildren = [...block.children]
    newChildren[index] = { ...newChildren[index], blocks }
    onChange({ children: newChildren })
  }

  const handleAddColumn = () => {
    const newChildren = [...block.children, { width: '50%', blocks: [] }]
    onChange({ children: newChildren })
  }

  const handleRemoveColumn = (index: number) => {
    if (block.children.length > 1) {
      const newChildren = block.children.filter((_, i) => i !== index)
      onChange({ children: newChildren })
    }
  }

  const handleUpdateWidth = (index: number, width: string) => {
    const newChildren = [...block.children]
    newChildren[index] = { ...newChildren[index], width }
    onChange({ children: newChildren })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">{block.children.length} Columnas</h4>
        <div className="flex gap-2">
          <button
            onClick={handleAddColumn}
            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            + Agregar
          </button>
        </div>
      </div>

      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Separación (px)</span>
        <input
          type="number"
          value={block.gap || 0}
          onChange={(e) => onChange({ gap: parseInt(e.target.value) })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <div className="space-y-4">
        {block.children.map((child, index) => (
          <div key={index} className="border border-gray-200 rounded-md p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="flex-1 mr-2">
                <span className="block text-xs font-medium text-gray-700 mb-1">Ancho (Columna {index + 1})</span>
                <input
                  type="text"
                  value={child.width}
                  onChange={(e) => handleUpdateWidth(index, e.target.value)}
                  placeholder="50% o 200px"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </label>
              <button
                onClick={() => handleRemoveColumn(index)}
                disabled={block.children.length === 1}
                className="mt-5 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="bg-white border border-dashed border-gray-300 rounded p-2">
              <p className="text-xs text-gray-500 mb-2">Bloques en esta columna:</p>
              <BlockCanvas
                blocks={child.blocks}
                onChange={(blocks) => handleUpdateChild(index, blocks)}
                availableColumns={availableColumns}
                subItemColumns={subItemColumns}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
