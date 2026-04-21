import type { CellProps } from '../types'

export function AutonumberCell({ value }: CellProps) {
  return (
    <span className="block w-full px-2.5 py-1.5 text-[11.5px] text-[var(--ink-3)] select-none font-[family-name:var(--font-geist-mono)] tabular-nums">
      {value != null ? String(value) : '—'}
    </span>
  )
}
