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
      className={`block w-full px-2.5 py-1.5 text-[13px] font-medium truncate font-[family-name:var(--font-geist-mono)] tabular-nums ${
        isNull ? 'text-[var(--ink-3)]' : 'text-[var(--ink)]'
      }`}
    >
      {displayValue}
    </span>
  )
}
