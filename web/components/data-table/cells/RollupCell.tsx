'use client'

import type { CellProps } from '../types'

export function RollupCell({ value }: CellProps) {
  const displayValue = (() => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'number') return value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
    return String(value)
  })()

  return (
    <span className={`block w-full px-2 py-1 text-[13px] font-medium truncate ${value == null ? 'text-gray-300' : 'text-teal-600'}`}>
      {displayValue}
    </span>
  )
}
