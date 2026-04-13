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
  fields:       ImportField[]                   // source fields (Airtable / CSV headers / etc.)
  boardColumns: BoardColumn[]
  mapping:      Record<string, string>          // field.key → col_key
  onChange:     (mapping: Record<string, string>, columns: BoardColumn[]) => void
  onNext:       () => void
  onBack:       () => void
}

const COLUMN_KINDS = [
  { value: 'text',        label: 'Texto' },
  { value: 'number',      label: 'Número' },
  { value: 'date',        label: 'Fecha' },
  { value: 'select',      label: 'Selección' },
  { value: 'multiselect', label: 'Multi-selección' },
  { value: 'boolean',     label: 'Checkbox' },
  { value: 'email',       label: 'Email' },
  { value: 'phone',       label: 'Teléfono' },
  { value: 'url',         label: 'URL' },
] as const

type CreatingState = { name: string; kind: string; saving: boolean; error: string | null }

export function ColumnMapper({ boardId, fields, boardColumns, mapping, onChange, onNext, onBack }: Props) {
  // localColumns = boardColumns + any newly created ones
  const [localColumns, setLocalColumns] = useState<BoardColumn[]>(boardColumns)

  // Per-field "create new" state: fieldKey → CreatingState | null
  const [creating, setCreating] = useState<Record<string, CreatingState>>({})

  const setMap = (fieldKey: string, colKey: string) => {
    const next = { ...mapping }
    if (colKey) {
      // Prevent duplicate mappings
      for (const [k, v] of Object.entries(next)) {
        if (v === colKey && k !== fieldKey) delete next[k]
      }
    }
    next[fieldKey] = colKey
    onChange(next, localColumns)
  }

  const startCreating = (fieldKey: string, defaultName: string) => {
    setCreating(prev => ({
      ...prev,
      [fieldKey]: { name: defaultName, kind: 'text', saving: false, error: null },
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

      // Auto-map this field to the new column
      const nextMapping = { ...mapping }
      for (const [k, v] of Object.entries(nextMapping)) {
        if (v === col.col_key && k !== fieldKey) delete nextMapping[k]
      }
      nextMapping[fieldKey] = col.col_key
      onChange(nextMapping, newCols)

      // Close creating form
      cancelCreating(fieldKey)
    } catch (e) {
      setCreating(prev => ({
        ...prev,
        [fieldKey]: { ...prev[fieldKey], saving: false, error: e instanceof Error ? e.message : 'Error al crear' },
      }))
    }
  }

  const mappedCount = Object.values(mapping).filter(Boolean).length

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
              <div key={field.key}>
                {/* Main row */}
                <div className="grid grid-cols-2 items-center px-3 py-2 gap-3">
                  <span className="text-[13px] text-gray-700 truncate" title={field.label}>
                    {field.label}
                  </span>

                  {cr ? (
                    // "Creating" badge while form is open
                    <span className="text-[12px] text-indigo-600 italic">Creando columna nueva…</span>
                  ) : (
                    <select
                      value={mapping[field.key] ?? ''}
                      onChange={e => {
                        if (e.target.value === '__create__') {
                          startCreating(field.key, field.label)
                        } else {
                          setMap(field.key, e.target.value)
                        }
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
                </div>

                {/* Inline create form */}
                {cr && (
                  <div className="mx-3 mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-md flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        value={cr.name}
                        onChange={e => setCreating(prev => ({
                          ...prev,
                          [field.key]: { ...prev[field.key], name: e.target.value },
                        }))}
                        placeholder="Nombre de la columna"
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-[12px] focus:outline-none focus:border-indigo-400 bg-white"
                      />
                      <select
                        value={cr.kind}
                        onChange={e => setCreating(prev => ({
                          ...prev,
                          [field.key]: { ...prev[field.key], kind: e.target.value },
                        }))}
                        className="px-2 py-1.5 border border-gray-200 rounded text-[12px] focus:outline-none focus:border-indigo-400 bg-white"
                      >
                        {COLUMN_KINDS.map(k => (
                          <option key={k.value} value={k.value}>{k.label}</option>
                        ))}
                      </select>
                    </div>
                    {cr.error && <p className="text-[11px] text-red-600">{cr.error}</p>}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => cancelCreating(field.key)}
                        disabled={cr.saving}
                        className="text-[12px] text-gray-500 hover:text-gray-700 px-2 py-1 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveColumn(field.key)}
                        disabled={!cr.name || cr.saving}
                        className="px-3 py-1 bg-indigo-600 text-white text-[12px] font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {cr.saving ? 'Creando…' : 'Crear columna'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        {mappedCount} campo{mappedCount !== 1 ? 's' : ''} mapeado{mappedCount !== 1 ? 's' : ''}
        {localColumns.length > boardColumns.length && (
          <span className="ml-2 text-indigo-500">
            · {localColumns.length - boardColumns.length} columna{localColumns.length - boardColumns.length !== 1 ? 's' : ''} nueva{localColumns.length - boardColumns.length !== 1 ? 's' : ''} creada{localColumns.length - boardColumns.length !== 1 ? 's' : ''}
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
