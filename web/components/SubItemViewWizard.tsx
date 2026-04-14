'use client'

import { useState, useEffect } from 'react'

type Preset = 'catalogo' | 'archivos' | 'cotizaciones' | 'manual'
type Mode   = 'snapshot' | 'reference'

type Board  = { id: string; name: string; type: string }
type Column = { id: string; col_key: string; name: string; kind: string }

type SubItemView = {
  id: string; sid: number; name: string; position: number
  type: 'native' | 'board_items' | 'board_sub_items'
  config: Record<string, unknown>
}

type Props = {
  boardId:      string
  onCreated:    (view: SubItemView, sourceBoardId: string | null) => void
  onClose:      () => void
}

// ─── Presets metadata ─────────────────────────────────────────────────────────

const PRESETS: { id: Preset; label: string; desc: string; emoji: string; needsSource: boolean }[] = [
  { id: 'catalogo',     label: 'Catálogo',               emoji: '📦', desc: 'Productos del catálogo',        needsSource: true  },
  { id: 'archivos',     label: 'Archivos',                emoji: '📎', desc: 'Adjuntos y documentos',         needsSource: false },
  { id: 'cotizaciones', label: 'Cotizaciones y Facturas', emoji: '🧾', desc: 'Documentos de venta',           needsSource: true  },
  { id: 'manual',       label: 'Libre / Manual',          emoji: '✏️', desc: 'Sub-items sin fuente',          needsSource: false },
]

const PRESET_NAMES: Record<Preset, string> = {
  catalogo:     'Catálogo',
  archivos:     'Archivos',
  cotizaciones: 'Cotizaciones y Facturas',
  manual:       'Sub-items',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubItemViewWizard({ boardId, onCreated, onClose }: Props) {
  const [step,          setStep]          = useState<1 | 2>(1)
  const [preset,        setPreset]        = useState<Preset | null>(null)
  const [boards,        setBoards]        = useState<Board[]>([])
  const [sourceBoardId, setSourceBoardId] = useState('')
  const [mode,          setMode]          = useState<Mode>('snapshot')
  const [relCols,       setRelCols]       = useState<Column[]>([])
  const [relColId,      setRelColId]      = useState('')
  const [saving,        setSaving]        = useState(false)
  const [boardsLoading, setBoardsLoading] = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // Fetch workspace boards on mount
  useEffect(() => {
    setBoardsLoading(true)
    fetch('/api/boards')
      .then(r => r.json())
      .then(data => setBoards(Array.isArray(data) ? data.filter((b: Board) => b.id !== boardId) : []))
      .catch(() => setBoards([]))
      .finally(() => setBoardsLoading(false))
  }, [boardId])

  // Fetch relation columns when source board + reference mode
  useEffect(() => {
    if (!sourceBoardId || mode !== 'reference') { setRelCols([]); setRelColId(''); return }
    fetch(`/api/boards/${sourceBoardId}/columns`)
      .then(r => r.json())
      .then(data => setRelCols(Array.isArray(data) ? data.filter((c: Column) => c.kind === 'relation') : []))
      .catch(() => setRelCols([]))
  }, [sourceBoardId, mode])

  // ── Create view ─────────────────────────────────────────────────────────────

  const create = async (p: Preset, sbId: string, m: Mode, rcId: string) => {
    setSaving(true)
    setError(null)
    try {
      let type: 'native' | 'board_items' = 'native'
      const config: Record<string, unknown> = {}

      if (p === 'archivos') {
        config.preset = 'files'
      } else if (p === 'manual') {
        // plain native, no config
      } else {
        // catalogo or cotizaciones
        if (m === 'snapshot') {
          config.source_board_id = sbId
        } else {
          type = 'board_items'
          config.source_board_id = sbId
          config.relation_col_id = rcId
        }
      }

      const res = await fetch(`/api/boards/${boardId}/sub-item-views`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: PRESET_NAMES[p], type, config }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? `Error ${res.status}`)
        setSaving(false)
        return
      }
      const newView = (await res.json()) as SubItemView

      // For snapshot mode → also PATCH board.sub_items_source_board_id for backward compat
      const snapshotBoardId = (type === 'native' && config.source_board_id) ? sbId : null
      if (snapshotBoardId) {
        await fetch(`/api/boards/${boardId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sub_items_source_board_id: snapshotBoardId }),
        })
      }

      onCreated(newView, snapshotBoardId)
    } catch (e) {
      console.error('[SubItemViewWizard] create error:', e)
      setError('Error de red. Revisa la consola.')
    } finally {
      setSaving(false)
    }
  }

  // ── Handle preset click ─────────────────────────────────────────────────────

  const handlePreset = (p: Preset) => {
    setPreset(p)
    const meta = PRESETS.find(x => x.id === p)!
    if (!meta.needsSource) {
      create(p, '', 'snapshot', '')
    } else {
      setStep(2)
    }
  }

  // ── Step 2 submit ───────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!preset || !sourceBoardId) return
    if (mode === 'reference' && !relColId) return
    create(preset, sourceBoardId, mode, relColId)
  }

  const canSubmit = !!sourceBoardId && (mode === 'snapshot' || !!relColId) && !saving

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {step === 2 && preset ? (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
                <path d="M9 11L5 7l4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {PRESET_NAMES[preset]}
            </button>
          ) : (
            <p className="text-[14px] font-semibold text-gray-900">Agregar vista de sub-items</p>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none">×</button>
        </div>

        {/* ── Step 1: Preset picker ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-5">
            {error && (
              <div className="mb-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-[12px] text-red-700">
                {error}
              </div>
            )}
            <p className="text-[12px] text-gray-500 mb-4">
              Elige cómo quieres usar los sub-items en este board.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePreset(p.id)}
                  disabled={saving}
                  className="flex flex-col items-start gap-1.5 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/40 transition-all text-left group disabled:opacity-50"
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="text-[13px] font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">
                    {p.label}
                  </span>
                  <span className="text-[11px] text-gray-500">{p.desc}</span>
                </button>
              ))}
            </div>
            {saving && (
              <p className="text-center text-[12px] text-gray-400 mt-4">Creando vista...</p>
            )}
          </div>
        )}

        {/* ── Step 2: Configure source + mode ─────────────────────────────── */}
        {step === 2 && preset && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-[12px] text-red-700">
                {error}
              </div>
            )}

            {/* Board picker */}
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Board fuente
              </label>
              {boardsLoading ? (
                <div className="h-9 bg-gray-100 rounded-md animate-pulse" />
              ) : (
                <select
                  value={sourceBoardId}
                  onChange={e => { setSourceBoardId(e.target.value); setRelColId('') }}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                >
                  <option value="">Seleccionar board...</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Mode picker */}
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-2">Modo</label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="radio" name="mode" value="snapshot"
                    checked={mode === 'snapshot'}
                    onChange={() => setMode('snapshot')}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-gray-800">Snapshot <span className="text-indigo-500 text-[11px] font-normal ml-1">recomendado</span></p>
                    <p className="text-[11px] text-gray-500">Copia los valores al agregar. Editable de forma independiente.</p>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="radio" name="mode" value="reference"
                    checked={mode === 'reference'}
                    onChange={() => setMode('reference')}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-gray-800">Referencia</p>
                    <p className="text-[11px] text-gray-500">Muestra datos vivos del board fuente. Solo lectura.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Relation column (only for reference mode) */}
            {mode === 'reference' && (
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Columna de relación
                  <span className="text-gray-400 font-normal ml-1">(en el board fuente)</span>
                </label>
                {relCols.length === 0 && sourceBoardId ? (
                  <p className="text-[12px] text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                    El board seleccionado no tiene columnas de tipo <strong>relación</strong>. Agrégalas en Settings.
                  </p>
                ) : (
                  <select
                    value={relColId}
                    onChange={e => setRelColId(e.target.value)}
                    disabled={!sourceBoardId}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 disabled:opacity-50"
                  >
                    <option value="">Seleccionar columna...</option>
                    {relCols.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 px-4 py-2 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                {saving ? 'Creando...' : 'Crear vista'}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-gray-200 text-gray-700 text-[13px] rounded-lg hover:bg-gray-50 transition-colors"
              >
                Atrás
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
