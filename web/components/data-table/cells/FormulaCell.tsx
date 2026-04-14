'use client'

import type { CellProps } from '../types'

export function FormulaCell({ value }: CellProps) {
  // Read-only computed field
  const displayValue = (() => {
    if (value === null || value === undefined) {
      return '—'
    }

    if (typeof value === 'number') {
      return value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
    }

    if (typeof value === 'string') {
      return value
    }

    return String(value)
  })()

  const isNull = value === null || value === undefined

  return (
    <span
      className={`block w-full px-2 py-1 text-[13px] font-medium truncate ${
        isNull ? 'text-gray-300' : 'text-indigo-600'
      }`}
    >
      {displayValue}
    </span>
  )
}
