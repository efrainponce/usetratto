'use client'

import { useState } from 'react'
import type { ImportField } from './sources/types'

type BoardColumn = {
  id:        string
  col_key:   string
  name:      string
  kind:      string
  is_system: boolean
}

type Props = {
  boardId:      string
  fields:       ImportField[]
  boardColumns: BoardColumn[]
  mapping:      Record<string, string>          // field.key → col_key
  onChange:     (mapping: Record<string, string>, columns: BoardColumn[]) => void
  onNext:       () => void
  onBack:       () => void
}

// ─── Kind labels shown as badges ──────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  text:        'texto',
  number:      'número',
  date:        'fecha',
  select:      'selección',
  multiselect: 'multi',
  boolean:     'checkbox',
  email:       'email',
  phone:       'teléfono',
  url:         'URL',
  people:      'persona',
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className="shrink-0 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
      {KIND_LABEL[kind] ?? kind}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

type CreatingState = { name: string; kind: string; saving: boolean; error: string | null }

export function ColumnMapper({ boardId, fields, boardColumns, mapping, onChange, onNext, onBack }: Props) {
  const [localColumns, setLocalColumns] = useState<BoardColumn[]>(boardColumns)
  const [creating,     setCreating]     = useState<Record<string, CreatingState>>({})

  const setMap = (fieldKey: string, colKey: string) => {
    const next = { ...mapping }
    if (colKey) {
      for (const [k, v] of Object.entries(next)) {
        if (v === colKey && k !== fieldKey) delete next[k]
      }
    }
    next[fieldKey] = colKey
    onChange(next, localColumns)
  }

  const startCreating = (field: ImportField) => {
    setCreating(prev => ({
      ...prev,
      [field.key]: {
        name:    field.label,
        kind:    field.sourceKind ?? 'text',
        saving:  false,
        error:   null,
      },
    }))
  }

  const cancelCreating = (fieldKey: string) => {
    setCreating(prev => { const n = { ...prev }; delete n[fieldKey]; return n })
  }

  const saveColumn = async (fieldKey: string) => {
    const state = creating[fieldKey]
    if (!state?.name) return
    setCreating(prev => ({ ...prev, [fieldKey]: { ...prev[fieldKey], saving: true, error: null } }))

    try {
      const res = await fetch(`/api/boards/${boardId}/columns`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: state.name, kind: state.kind }),
      })
      const col = await res.json() as BoardColumn & { error?: string }
      if (!res.ok) throw new Error(col.error ?? `Error ${res.status}`)

      const newCols = [...localColumns, col]
      setLocalColumns(newCols)

      // Auto-map + clear duplicate mapping
      const nextMapping = { ...mapping }
      for (const [k, v] of Object.entries(nextMapping)) {
        if (v === col.col_key && k !== fieldKey) delete nextMapping[k]
      }
      nextMapping[fieldKey] = col.col_key
      onChange(nextMapping, newCols)

      cancelCreating(fieldKey)
    } catch (e) {
      setCreating(prev => ({
        ...prev,
        [fieldKey]: { ...prev[fieldKey], saving: false, error: e instanceof Error ? e.message : 'Error al crear' },
      }))
    }
  }

  const mappedCount  = Object.values(mapping).filter(Boolean).length
  const createdCount = localColumns.length - boardColumns.length

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-gray-500">
        Mapea cada campo a una columna existente, crea una nueva, u omítelo.
      </p>

      {/* Mapping table */}
      <div className="border border-gray-100 rounded-md overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Campo fuente</span>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Columna en Tratto</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {fields.map(field => {
            const cr = creating[field.key]
            return (
              <div key={field.key} className="px-3 py-2 flex items-center gap-3">
                {/* Left: source field name + type badge */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[13px] text-gray-700 truncate" title={field.label}>
                    {field.label}
                  </span>
                  {field.sourceKind && <KindBadge kind={field.sourceKind} />}
                </div>

                {/* Right: mapping control */}
                <div className="flex-1">
                  {cr ? (
                    /* Create mode: name input + kind badge + Crear button */
                    <div className="flex items-center gap-1.5">
                      <input
                        value={cr.name}
                        onChange={e => setCreating(prev => ({
                          ...prev,
                          [field.key]: { ...prev[field.key], name: e.target.value },
                        }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && cr.name && !cr.saving) saveColumn(field.key)
                          if (e.key === 'Escape') cancelCreating(field.key)
                        }}
                        autoFocus
                        placeholder="Nombre de la columna"
                        className="flex-1 min-w-0 px-2 py-1 border border-indigo-300 rounded text-[12px] focus:outline-none focus:border-indigo-500 bg-white"
                      />
                      <KindBadge kind={cr.kind} />
                      <button
                        onClick={() => saveColumn(field.key)}
                        disabled={!cr.name || cr.saving}
                        className="shrink-0 px-2.5 py-1 bg-indigo-600 text-white text-[12px] font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {cr.saving ? '…' : 'Crear'}
                      </button>
                      <button
                        onClick={() => cancelCreating(field.key)}
                        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Cancelar"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
                          <path d="M3 3l6 6M9 3l-6 6" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    /* Normal mode: dropdown */
                    <select
                      value={mapping[field.key] ?? ''}
                      onChange={e => {
                        if (e.target.value === '__create__') startCreating(field)
                        else setMap(field.key, e.target.value)
                      }}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700 focus:outline-none focus:border-indigo-400 bg-white"
                    >
                      <option value="">— Omitir —</option>
                      {localColumns.map(c => (
                        <option key={c.col_key} value={c.col_key}>{c.name}</option>
                      ))}
                      <option value="__create__">✦ Crear columna nueva…</option>
                    </select>
                  )}
                  {cr?.error && (
                    <p className="text-[11px] text-red-600 mt-1">{cr.error}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status line */}
      <p className="text-[11px] text-gray-400">
        {mappedCount} campo{mappedCount !== 1 ? 's' : ''} mapeado{mappedCount !== 1 ? 's' : ''}
        {createdCount > 0 && (
          <span className="ml-2 text-emerald-500">
            · {createdCount} columna{createdCount !== 1 ? 's' : ''} nueva{createdCount !== 1 ? 's' : ''} creada{createdCount !== 1 ? 's' : ''}
          </span>
        )}
      </p>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={onNext}
          disabled={mappedCount === 0}
          className="px-4 py-2 bg-indigo-600 text-white text-[13px] font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
