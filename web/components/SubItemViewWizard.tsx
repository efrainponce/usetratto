'use client'

import { useState, useEffect } from 'react'

type Board = { id: string; name: string; type: string }

type SubItemView = {
  id: string; sid: number; name: string; position: number
  type: 'native' | 'board_items' | 'board_sub_items'
  config: Record<string, unknown>
}

type Props = {
  boardId:       string
  existingViews: SubItemView[]
  onCreated:     (view: SubItemView, sourceBoardId: string | null) => void
  onClose:       () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubItemViewWizard({ boardId, existingViews, onCreated, onClose }: Props) {
  // Step 1 state
  const [boards,        setBoards]        = useState<Board[]>([])
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [sourceBoardId, setSourceBoardId] = useState<string | null>(null) // null = manual

  // Step 2 state
  const [step,      setStep]      = useState<1 | 2>(1)
  const [viewName,  setViewName]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/boards')
      .then(r => r.json())
      .then(data => setBoards(Array.isArray(data) ? data.filter((b: Board) => b.id !== boardId) : []))
      .catch(() => setBoards([]))
      .finally(() => setBoardsLoading(false))
  }, [boardId])

  // ── Step 1: board selected ─────────────────────────────────────────────────

  const handleBoardNext = (bid: string | null) => {
    setSourceBoardId(bid)
    if (bid === null) {
      // Manual — create immediately with default name
      createView(null, 'Sub-items')
    } else {
      const name = boards.find(b => b.id === bid)?.name ?? ''
      setViewName(name)
      setStep(2)
    }
  }

  // ── Create view ────────────────────────────────────────────────────────────

  const createView = async (sbId: string | null, name: string) => {
    setSaving(true)
    setError(null)
    try {
      const config: Record<string, unknown> = {}
      if (sbId) config.source_board_id = sbId

      const finalName = name.trim() || (sbId ? (boards.find(b => b.id === sbId)?.name ?? 'Vista') : 'Sub-items')

      const res = await fetch(`/api/boards/${boardId}/sub-item-views`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: finalName, type: 'native', config }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? `Error ${res.status}`)
        setSaving(false)
        return
      }

      const newView = (await res.json()) as SubItemView
      onCreated(newView, sbId)
    } catch (e) {
      console.error('[SubItemViewWizard] error:', e)
      setError('Error de red.')
      setSaving(false)
    }
  }

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceBoardId) return
    createView(sourceBoardId, viewName)
  }

  const canSubmitStep2 = !!sourceBoardId && !saving

  // ─── Render ─────────────────────────────────────────────────────────────────

  const selectedBoard = boards.find(b => b.id === sourceBoardId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {step === 2 ? (
            <button
              onClick={() => { setStep(1); setError(null) }}
              className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
                <path d="M9 11L5 7l4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {selectedBoard?.name ?? 'Nueva vista'}
            </button>
          ) : (
            <p className="text-[14px] font-semibold text-gray-900">Nueva vista de sub-items</p>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">×</button>
        </div>

        {error && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-[12px] text-red-700">
            {error}
          </div>
        )}

        {/* ── Step 1: Board picker ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-5">

            {/* Existing views */}
            {existingViews.length > 0 && (
              <div className="mb-4 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Vistas actuales</p>
                <div className="flex flex-wrap gap-1.5">
                  {existingViews.map(v => (
                    <span key={v.id} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[12px] text-gray-600">
                      {v.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[12px] text-gray-500 mb-4">
              ¿Desde qué board quieres agregar sub-items?
            </p>

            {boardsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {boards.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleBoardNext(b.id)}
                    disabled={saving}
                    className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/40 transition-all text-left group disabled:opacity-50"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-gray-800 group-hover:text-indigo-700 transition-colors">
                        {b.name}
                      </p>
                      <p className="text-[11px] text-gray-400 capitalize">{b.type}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current text-gray-300 group-hover:text-indigo-400 transition-colors flex-none">
                      <path d="M5 3l4 4-4 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}

                {/* Divider */}
                <div className="pt-1 pb-0.5">
                  <div className="h-px bg-gray-100" />
                </div>

                {/* Manual option */}
                <button
                  onClick={() => handleBoardNext(null)}
                  disabled={saving}
                  className="w-full flex items-center justify-between px-4 py-3 border border-dashed border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-left group disabled:opacity-50"
                >
                  <div>
                    <p className="text-[13px] font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                      ✏️ Manual
                    </p>
                    <p className="text-[11px] text-gray-400">Sin fuente. Agrega columnas libremente.</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current text-gray-300 group-hover:text-gray-500 transition-colors flex-none">
                    <path d="M5 3l4 4-4 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            )}
            {saving && <p className="text-center text-[12px] text-gray-400 mt-4">Creando vista...</p>}
          </div>
        )}

        {/* ── Step 2: Name ─────────────────────────────────────────────────── */}
        {step === 2 && sourceBoardId && (
          <form onSubmit={handleStep2Submit} className="p-5 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Nombre de la vista
              </label>
              <input
                autoFocus
                type="text"
                value={viewName}
                onChange={e => setViewName(e.target.value)}
                placeholder="Ej. Catálogo, Productos, Líneas..."
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
            </div>

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={!canSubmitStep2}
                className="w-full px-4 py-2.5 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                {saving ? 'Creando...' : 'Crear vista'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
