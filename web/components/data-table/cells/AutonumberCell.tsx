import type { CellProps } from '../types'

export function AutonumberCell({ value, column }: CellProps) {
  const prefix = typeof column.settings.prefix === 'string' ? column.settings.prefix : ''
  const pad    = typeof column.settings.pad === 'number' ? column.settings.pad : 0

  let formatted: string = '—'
  if (value !== null && value !== undefined && value !== '') {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10)
    if (!isNaN(n)) {
      const padded = pad > 0 ? String(n).padStart(pad, '0') : String(n)
      formatted = prefix ? `${prefix}-${padded}` : padded
    } else {
      formatted = String(value)
    }
  }

  return (
    <span className="block w-full px-2.5 py-1.5 text-[11.5px] text-[var(--ink-3)] select-none font-[family-name:var(--font-geist-mono)] tabular-nums">
      {formatted}
    </span>
  )
}
