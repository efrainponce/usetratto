import type { CellProps } from '../types'

export function AutonumberCell({ value }: CellProps) {
  return (
    <span className="block w-full px-2 py-1 text-[11px] text-gray-400 select-none font-mono tabular-nums">
      {value != null ? String(value) : '—'}
    </span>
  )
}
