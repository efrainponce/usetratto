'use client'

import { useState, useEffect, useMemo } from 'react'

type Item = { id: string; sid: number; name: string }

type Props = {
  targetBoardId: string
  targetBoardName?: string
  currentItemId?: string | null
  onPick: (itemId: string | null, itemName: string) => void
  onClose: () => void
}

export function RelationPicker({ targetBoardId, targetBoardName, currentItemId, onPick, onClose }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`/api/items?boardId=${targetBoardId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Item[]) => setItems(data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [targetBoardId])

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(it => it.name?.toLowerCase().includes(q) || String(it.sid).includes(q))
  }, [items, search])

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Buscar en {targetBoardName ?? 'board'}</div>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Escribe para filtrar…"
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Sin resultados</div>
          ) : (
            filtered.map(it => (
              <button
                key={it.id}
                onClick={() => onPick(it.id, it.name)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 border-b border-gray-50 flex items-center justify-between ${it.id === currentItemId ? 'bg-indigo-50' : ''}`}
              >
                <span className="text-gray-700 truncate">{it.name}</span>
                <span className="text-xs text-gray-400 ml-2 tabular-nums">{it.sid}</span>
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t border-gray-100 flex justify-between">
          <button
            onClick={() => onPick(null, '')}
            disabled={!currentItemId}
            className="text-xs text-red-600 hover:underline disabled:text-gray-300"
          >
            Quitar relación
          </button>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancelar (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
