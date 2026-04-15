'use client'

import type { CellProps } from '../types'

// Relation cells display a linked item name.
// Editing opens a picker modal — BoardView provides onPickRelation via column.settings.
// For Phase 3 we render display-only; full picker in Phase 4.
// TODO Fase 16.6: when showing related-item field preview, filter columns
// the user cannot view in the target board via userCanViewColumn()
export function RelationCell({ value, onStartEdit }: CellProps) {
  const label = typeof value === 'string' ? value : (Array.isArray(value) ? value[0] : null)

  return (
    <div
      className="flex items-center gap-1 w-full px-2 py-1 cursor-default"
      onDoubleClick={onStartEdit}
    >
      {label ? (
        <span className="text-[13px] text-gray-700 truncate">{label}</span>
      ) : (
        <span className="text-[13px] text-gray-300">—</span>
      )}
    </div>
  )
}
