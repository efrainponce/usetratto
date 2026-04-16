'use client'

import { useState, useEffect, useRef } from 'react'
import { useAsyncData } from '../hooks/useAsyncData'

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  sid: number
  name: string
}

type Props = {
  sourceBoardId: string
  onSelect: (item: { id: string; sid: number; name: string }) => void
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductPicker({ sourceBoardId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load items from source board on mount ──────────────────────────────────

  // 16.12: picker uses GET /api/items which already enforces restrict_to_own (Fase 9)
  const { data: rawData, loading } = useAsyncData<Array<{
    id: string
    sid: number
    name: string
  }>>(`/api/items?boardId=${sourceBoardId}`)

  const items: Item[] = (rawData ?? []).map(item => ({
    id: item.id,
    sid: item.sid,
    name: item.name,
  }))

  // ── Filtered list (fuzzy by name) ──────────────────────────────────────────

  const filtered = query.trim() === ''
    ? items
    : items.filter(i =>
        i.name.toLowerCase().includes(query.toLowerCase())
      )

  // ── Close on Escape ────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="pointer-events-auto bg-white rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col overflow-hidden"
          style={{ maxHeight: '70vh' }}
          onClick={e => e.stopPropagation()}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-[14px] font-semibold text-gray-800">Seleccionar item</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
                <path d="M4 4l8 8M12 4l-8 8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar item..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full text-[13px] px-3 py-1.5 rounded-lg border border-gray-200 focus:border-indigo-400 outline-none transition-colors bg-gray-50 focus:bg-white"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8 text-[13px] text-gray-400">
                Cargando...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex items-center justify-center py-8 text-[13px] text-gray-400 italic">
                {query ? 'Sin resultados' : 'Sin items'}
              </div>
            )}

            {!loading && filtered.map(item => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left border-b border-gray-50"
              >
                <span className="text-[11px] text-gray-400 font-mono flex-none">
                  {item.sid}
                </span>
                <span className="text-[13px] text-gray-800 truncate">{item.name}</span>
              </button>
            ))}
          </div>

          {/* Footer count */}
          {!loading && (
            <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
