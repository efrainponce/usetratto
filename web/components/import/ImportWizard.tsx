'use client'

import { useState } from 'react'
import { IMPORT_SOURCES } from './sources'
import { ColumnMapper }   from './ColumnMapper'
import type { ImportSource, ConnectResult } from './sources/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BoardColumn = {
  id:        string
  col_key:   string
  name:      string
  kind:      string
  is_system: boolean
}

type Props = {
  boardId:      string
  boardColumns: BoardColumn[]
  onClose:      () => void
  onImported:   (count: number) => void
}

type WizardStep =
  | { type: 'pick-source' }
  | { type: 'connect';     source: ImportSource }
  | { type: 'map-columns'; source: ImportSource; connected: ConnectResult }
  | { type: 'importing';   source: ImportSource; connected: ConnectResult; mapping: Record<string, string> }

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportWizard({ boardId, boardColumns, onClose, onImported }: Props) {
  const [step,         setStep]         = useState<WizardStep>({ type: 'pick-source' })
  const [mapping,      setMapping]      = useState<Record<string, string>>({})
  const [localColumns, setLocalColumns] = useState<BoardColumn[]>(boardColumns)
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)

  // ── Step labels ────────────────────────────────────────────────────────────
  const stepLabel = (() => {
    if (step.type === 'pick-source') return 'Importar registros'
    const label = step.source.label
    if (step.type === 'connect')     return `Conectar con ${label}`
    if (step.type === 'map-columns') return 'Mapear columnas'
    return `Importando desde ${label}…`
  })()

  // ── Smart default mapping when ConnectStep returns fields ─────────────────
  const buildDefaultMapping = (fields: ConnectResult['fields'], cols: BoardColumn[]): Record<string, string> => {
    const map: Record<string, string> = {}
    for (const field of fields) {
      const match = cols.find(c =>
        c.col_key === field.label.toLowerCase().replace(/\s+/g, '_') ||
        c.name.toLowerCase() === field.label.toLowerCase()
      )
      if (match) map[field.key] = match.col_key
    }
    return map
  }

  // ── Import: fetch all + map + POST /api/import/bulk ───────────────────────
  const handleImport = async (connected: ConnectResult, currentMapping: Record<string, string>) => {
    setError(null)
    setLoading(true)
    try {
      const rawRecords = await connected.fetchAll()

      // Apply mapping: source field.key → col_key
      const records = rawRecords.map(raw => {
        const record: Record<string, string> = {}
        for (const [fieldKey, colKey] of Object.entries(currentMapping)) {
          if (!colKey) continue
          const value = raw[fieldKey]
          if (value) record[colKey] = value
        }
        return record
      }).filter(r => r['name'])  // name is required

      if (records.length === 0) {
        setError('Ningún registro tiene el campo "name" mapeado. Asegúrate de mapear la columna de nombre.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/import/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ board_id: boardId, records }),
      })
      const data = await res.json() as { imported?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      onImported(data.imported ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar')
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="pointer-events-auto bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-[14px] font-semibold text-gray-800">{stepLabel}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
                <path d="M4 4l8 8M12 4l-8 8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 min-h-[300px]">

            {/* Step 1: Source picker */}
            {step.type === 'pick-source' && (
              <div>
                <p className="text-[12px] text-gray-500 mb-4">Elige el origen de los datos</p>
                <div className="grid grid-cols-2 gap-3">
                  {IMPORT_SOURCES.map(source => {
                    const Icon = source.icon
                    return (
                      <button
                        key={source.id}
                        onClick={() => setStep({ type: 'connect', source })}
                        className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-center"
                      >
                        <Icon className="text-gray-600" />
                        <span className="text-[13px] font-medium text-gray-800">{source.label}</span>
                        <span className="text-[11px] text-gray-500">{source.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2: ConnectStep (source-specific) */}
            {step.type === 'connect' && (
              <step.source.ConnectStep
                onConnected={connected => {
                  setLocalColumns(boardColumns)
                  setMapping(buildDefaultMapping(connected.fields, boardColumns))
                  setStep({ type: 'map-columns', source: step.source, connected })
                }}
                onBack={() => setStep({ type: 'pick-source' })}
              />
            )}

            {/* Step 3: ColumnMapper (generic) */}
            {step.type === 'map-columns' && (
              <ColumnMapper
                boardId={boardId}
                fields={step.connected.fields}
                boardColumns={localColumns}
                mapping={mapping}
                onChange={(newMapping, newCols) => {
                  setMapping(newMapping)
                  setLocalColumns(newCols)
                }}
                onNext={() => {
                  setStep({ type: 'importing', source: step.source, connected: step.connected, mapping })
                  handleImport(step.connected, mapping)
                }}
                onBack={() => setStep({ type: 'connect', source: step.source })}
              />
            )}

            {/* Step 4: Importing */}
            {step.type === 'importing' && (
              <div className="flex flex-col items-center justify-center h-48 gap-4">
                {loading ? (
                  <>
                    <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <p className="text-[13px] text-gray-500">Importando registros…</p>
                  </>
                ) : error ? (
                  <>
                    <p className="text-[13px] text-red-600 text-center">{error}</p>
                    <button
                      onClick={() => setStep({ type: 'map-columns', source: step.source, connected: step.connected })}
                      className="text-[12px] text-indigo-600 hover:text-indigo-700"
                    >
                      ← Volver al mapeo
                    </button>
                  </>
                ) : null}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
