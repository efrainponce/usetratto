'use client'

import { useEffect, useState } from 'react'
import { LoadingState } from './LoadingState'
import type { BoardSubData } from './types'

type Props = { itemId: string; viewId: string; viewName: string; compact?: boolean; isBoardAdmin?: boolean }

export function BoardSubItemsRenderer({ itemId, viewId, viewName }: Props) {
  const [data, setData] = useState<BoardSubData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sub-item-views/${viewId}/data?itemId=${itemId}`)
      .then(r => r.json())
      .then(d => setData(d as BoardSubData))
      .catch(e => console.error('[BoardSubItemsRenderer] error:', e))
      .finally(() => setLoading(false))
  }, [viewId, itemId])

  if (loading) return <LoadingState />

  const columns = (data?.columns ?? []).filter(c => c.kind !== 'formula')
  const items   = data?.items ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-2)] flex-none">
        <div className="flex-1 flex items-center gap-2 text-[11px] font-semibold text-[var(--ink-4)] uppercase tracking-wide select-none">
          <div className="w-16 flex-none">#</div>
          <div className="w-40 flex-none">Nombre</div>
          {columns.slice(0, 4).map(c => <div key={c.id} className="w-24 flex-none text-right">{c.name}</div>)}
        </div>
        <span className="flex-none text-[10px] bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-soft)] px-1.5 py-0.5 rounded-full font-medium">
          {viewName} · ref
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[13px] text-[var(--ink-3)] italic">
            Sin sub-items relacionados
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
              <div className="w-16 flex-none text-[12px] text-[var(--ink-3)] font-mono">{item.sid}</div>
              <div className="w-40 flex-none text-[13px] text-[var(--ink)] truncate">{item.name || '—'}</div>
              {columns.slice(0, 4).map(col => {
                const val = item.values.find(v => v.column_id === col.id)
                const display = val?.value_text ?? (val?.value_number != null ? String(val.value_number) : null)
                return (
                  <div key={col.id} className="w-24 flex-none text-[12px] text-[var(--ink-2)] truncate text-right">
                    {display ?? '—'}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
