'use client'

import type { CellProps } from '../types'

export function BooleanCell({ value, column, onCommit }: CellProps) {
  const checked = Boolean(value)

  return (
    <div
      className="flex items-center justify-center w-full h-full px-2.5 py-1.5"
      onClick={e => {
        e.stopPropagation()
        if (column.editable !== false) onCommit(!checked)
      }}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
        checked ? 'bg-[var(--brand)] border-[var(--brand)]' : 'border-[var(--border)] hover:border-[var(--brand-soft)]'
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
