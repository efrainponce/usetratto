'use client'

import type { CellProps } from '../types'

export function BooleanCell({ value, column, onCommit }: CellProps) {
  const checked = Boolean(value)

  return (
    <div
      className="flex items-center justify-center w-full h-full px-2 py-1"
      onClick={e => {
        e.stopPropagation()
        if (column.editable !== false) onCommit(!checked)
      }}
    >
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
        checked ? 'bg-gray-800 border-gray-800' : 'border-gray-300 hover:border-gray-500'
      }`}>
        {checked && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </div>
  )
}
