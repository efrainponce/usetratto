'use client'

import { useEffect, useRef } from 'react'

const ROLLUP_OPTIONS_NUMBER = [
  { value: 'sum',   label: 'Σ  Suma'     },
  { value: 'avg',   label: '⌀  Promedio' },
  { value: 'max',   label: '↑  Máximo'   },
  { value: 'min',   label: '↓  Mínimo'   },
  { value: 'count', label: '#  Conteo'   },
]

const ROLLUP_OPTIONS_SELECT = [
  { value: 'percent_done', label: '%  Completado' },
  { value: 'count',        label: '#  Conteo'     },
]

type Props = {
  target:    { colName: string; colKind?: string; closedValues?: string[]; currentAggregate?: string }
  saving:    boolean
  onSelect:  (aggregate: string) => void
  onRemove?: () => void
  onClose:   () => void
}

export function RollupUpPopup({ target, saving, onSelect, onRemove, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none">
      <div
        ref={ref}
        className="pointer-events-auto mt-24 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl w-52 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-3 py-2.5 border-b border-[var(--border)]">
          <p className="text-[11px] font-semibold text-[var(--ink-4)] uppercase tracking-wide">Resumen → item</p>
          <p className="text-[12px] text-[var(--ink)] truncate mt-0.5">"{target.colName}"</p>
        </div>
        <div className="py-1">
          {(target.colKind === 'select' ? ROLLUP_OPTIONS_SELECT : ROLLUP_OPTIONS_NUMBER).map(opt => (
            <button
              key={opt.value}
              onClick={() => !saving && onSelect(opt.value)}
              disabled={saving}
              className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-[var(--surface-2)] hover:text-[var(--brand)] transition-colors flex items-center justify-between ${target.currentAggregate === opt.value ? 'text-[var(--brand)] font-semibold' : 'text-[var(--ink)]'}`}
            >
              {opt.label}
              {target.currentAggregate === opt.value && <span className="text-[var(--brand)] text-[10px]">activo</span>}
            </button>
          ))}
        </div>
        {onRemove && (
          <div className="border-t border-[var(--border)] py-1">
            <button
              onClick={() => !saving && onRemove()}
              disabled={saving}
              className="w-full text-left px-3 py-1.5 text-[13px] text-[var(--stage-lost)] hover:bg-red-50 transition-colors"
            >
              Quitar resumen
            </button>
          </div>
        )}
        {saving && (
          <div className="px-3 py-2 text-[11px] text-[var(--ink-4)] text-center border-t border-[var(--border)]">Guardando…</div>
        )}
      </div>
    </div>
  )
}
