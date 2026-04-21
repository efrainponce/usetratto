'use client'

import type { CellProps } from '../types'

export function RollupCell({ value }: CellProps) {
  const displayValue = (() => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'number') return value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
    return String(value)
  })()

  return (
    <span className={`block w-full px-2.5 py-1.5 text-[13px] font-medium truncate font-[family-name:var(--font-geist-mono)] tabular-nums ${value == null ? 'text-[var(--ink-3)]' : 'text-[var(--ink)]'}`}>
      {displayValue}
    </span>
  )
}
