'use client'

import React from 'react'
import type { SubitemsTableBlock, BoardColumnMeta } from '@/lib/document-blocks'

interface SubitemsTableBlockEditorProps {
  block: SubitemsTableBlock
  onChange: (patch: Partial<SubitemsTableBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function SubitemsTableBlockEditor({
  block,
  onChange,
  subItemColumns,
}: SubitemsTableBlockEditorProps) {
  const numericColumns = subItemColumns.filter((col) => col.kind === 'number')

  const handleToggleColumn = (colKey: string) => {
    const columns = block.columns || []
    if (columns.includes(colKey)) {
      onChange({ columns: columns.filter((c) => c !== colKey) })
    } else {
      onChange({ columns: [...columns, colKey] })
    }
  }

  const handleToggleTotalColumn = (colKey: string) => {
    const total_col_keys = block.total_col_keys || []
    if (total_col_keys.includes(colKey)) {
      onChange({ total_col_keys: total_col_keys.filter((c) => c !== colKey) })
    } else {
      onChange({ total_col_keys: [...total_col_keys, colKey] })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-xs font-medium text-gray-700 mb-2">Columnas a mostrar</span>
        <div className="space-y-2">
          {subItemColumns.map((col) => (
            <label key={col.col_key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={block.columns?.includes(col.col_key) || false}
                onChange={() => handleToggleColumn(col.col_key)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">{col.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={block.show_totals || false}
            onChange={(e) => onChange({ show_totals: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">Mostrar totales</span>
        </label>
      </div>

      {block.show_totals && (
        <div>
          <span className="block text-xs font-medium text-gray-700 mb-2">Columnas a sumar</span>
          <div className="space-y-2">
            {numericColumns.map((col) => (
              <label key={col.col_key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={block.total_col_keys?.includes(col.col_key) || false}
                  onChange={() => handleToggleTotalColumn(col.col_key)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{col.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
