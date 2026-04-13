'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubItemColumn = {
  id: string
  board_id: string
  col_key: string
  name: string
  kind: string
  position: number
  is_hidden: boolean
  required: boolean
  settings: Record<string, unknown>
  source_col_key: string | null
}

type SourceBoard = {
  id: string
  sid: number
  name: string
}

type SourceColumn = {
  id: string
  col_key: string
  name: string
  kind: string
}

type ManualColumn = {
  tempId: string
  name: string
  kind: string
}

type CheckedSourceCol = {
  column: SourceColumn
  customName: string
}

type Props = {
  boardId: string
  currentSourceBoardId: string | null
  currentColumns: SubItemColumn[]
  onClose: () => void
  onSaved: (sourceBoardId: string | null, newColumns: SubItemColumn[]) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SourceColumnMapper({
  boardId,
  currentSourceBoardId,
  currentColumns,
  onClose,
  onSaved,
}: Props) {
  const [step, setStep] = useState<'board' | 'columns'>('board')
  const [boards, setBoards] = useState<SourceBoard[]>([])
  const [boardsLoading, setBoardsLoading] = useState(true)

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(currentSourceBoardId)
  const [sourceColumns, setSourceColumns] = useState<SourceColumn[]>([])
  const [columnsLoading, setColumnsLoading] = useState(false)

  const [checkedCols, setCheckedCols] = useState<CheckedSourceCol[]>([])
  const [manualCols, setManualCols] = useState<ManualColumn[]>([])
  const [saving, setSaving] = useState(false)

  // ── Load all boards on mount ───────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/boards')
      .then(r => r.json())
      .then((data: SourceBoard[]) => {
        setBoards(data)
        setBoardsLoading(false)
      })
      .catch(() => setBoardsLoading(false))
  }, [])

  // ── Load source board columns when selected board changes ────────────────────

  useEffect(() => {
    if (!selectedBoardId) {
      setSourceColumns([])
      setCheckedCols([])
      setManualCols([])
      return
    }

    setColumnsLoading(true)
    fetch(`/api/boards/${selectedBoardId}/columns`)
      .then(r => r.json())
      .then((data: SourceColumn[]) => {
        setSourceColumns(data)
        setCheckedCols([])
        setManualCols([])
        setColumnsLoading(false)
      })
      .catch(() => setColumnsLoading(false))
  }, [selectedBoardId])

  // ── Handle board selection ──────────────────────────────────────────────────

  const handleSelectBoard = (bid: string | null) => {
    setSelectedBoardId(bid)
  }

  const handleGoToColumns = () => {
    if (selectedBoardId) {
      setStep('columns')
    }
  }

  const handleBack = () => {
    setStep('board')
  }

  // ── Handle column checks ───────────────────────────────────────────────────

  const toggleColumn = (col: SourceColumn) => {
    const exists = checkedCols.some(c => c.column.col_key === col.col_key)
    if (exists) {
      setCheckedCols(checkedCols.filter(c => c.column.col_key !== col.col_key))
    } else {
      setCheckedCols([...checkedCols, { column: col, customName: col.name }])
    }
  }

  const updateColumnName = (colKey: string, newName: string) => {
    setCheckedCols(checkedCols.map(c =>
      c.column.col_key === colKey
        ? { ...c, customName: newName }
        : c
    ))
  }

  // ── Handle manual columns ──────────────────────────────────────────────────

  const addManualColumn = () => {
    setManualCols([...manualCols, {
      tempId: `manual_${Date.now()}`,
      name: '',
      kind: 'text',
    }])
  }

  const updateManualColumn = (tempId: string, field: 'name' | 'kind', value: string) => {
    setManualCols(manualCols.map(m =>
      m.tempId === tempId
        ? { ...m, [field]: value }
        : m
    ))
  }

  const removeManualColumn = (tempId: string) => {
    setManualCols(manualCols.filter(m => m.tempId !== tempId))
  }

  // ── Handle save ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedBoardId && checkedCols.length === 0 && manualCols.length === 0) {
      // Clearing source board
      try {
        setSaving(true)
        await fetch(`/api/boards/${boardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sub_items_source_board_id: null }),
        })
        onSaved(null, [])
      } catch (err) {
        console.error(err)
      } finally {
        setSaving(false)
      }
      return
    }

    if (!selectedBoardId) return

    try {
      setSaving(true)

      // 1. Patch board with source board ID
      await fetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_items_source_board_id: selectedBoardId }),
      })

      // 2. Create/update columns
      const savedColumns: SubItemColumn[] = []
      let position = 0

      // Save checked source columns
      for (const checked of checkedCols) {
        // Skip if already exists
        if (currentColumns.some(c => c.source_col_key === checked.column.col_key)) {
          continue
        }

        const response = await fetch(`/api/boards/${boardId}/sub-item-columns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            col_key: `src_${checked.column.col_key}`,
            name: checked.customName,
            kind: checked.column.kind,
            source_col_key: checked.column.col_key,
            position,
          }),
        })

        if (response.ok) {
          const newCol = await response.json()
          savedColumns.push(newCol)
          position++
        }
      }

      // Save manual columns
      for (const manual of manualCols) {
        if (!manual.name.trim()) continue

        const response = await fetch(`/api/boards/${boardId}/sub-item-columns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            col_key: `custom_${Date.now()}`,
            name: manual.name,
            kind: manual.kind,
            position,
          }),
        })

        if (response.ok) {
          const newCol = await response.json()
          savedColumns.push(newCol)
          position++
        }
      }

      onSaved(selectedBoardId, savedColumns)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

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
          className="pointer-events-auto bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col overflow-hidden"
          style={{ maxHeight: '85vh' }}
          onClick={e => e.stopPropagation()}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h2 className="text-[14px] font-semibold text-gray-800">
                {step === 'board' ? 'Seleccionar fuente' : 'Configurar columnas'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
                <path d="M4 4l8 8M12 4l-8 8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="px-4 py-2 flex items-center gap-2 text-[11px] text-gray-400 border-b border-gray-100">
            <div className={`w-1.5 h-1.5 rounded-full ${step === 'board' ? 'bg-indigo-600' : 'bg-gray-300'}`} />
            <span>Paso 1 de 2</span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {step === 'board' && (
              <div className="p-4">
                {boardsLoading ? (
                  <div className="flex items-center justify-center py-8 text-[13px] text-gray-400">
                    Cargando boards...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Sin fuente option */}
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="board-select"
                        checked={selectedBoardId === null}
                        onChange={() => handleSelectBoard(null)}
                        className="w-4 h-4 text-indigo-600 cursor-pointer"
                      />
                      <span className="text-[13px] text-gray-700">Sin fuente</span>
                    </label>

                    {/* Boards list */}
                    {boards.map(board => (
                      <label
                        key={board.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedBoardId === board.id
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="board-select"
                          checked={selectedBoardId === board.id}
                          onChange={() => handleSelectBoard(board.id)}
                          className="w-4 h-4 text-indigo-600 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="text-[13px] text-gray-800 truncate">{board.name}</div>
                          <div className="text-[11px] text-gray-400">ID: {board.sid}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 'columns' && (
              <div className="p-4">
                {columnsLoading ? (
                  <div className="flex items-center justify-center py-8 text-[13px] text-gray-400">
                    Cargando columnas...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Source columns */}
                    <div>
                      <div className="text-[13px] font-semibold text-gray-700 mb-2">Columnas de la fuente</div>
                      <div className="space-y-2">
                        {sourceColumns.map(col => {
                          const checked = checkedCols.find(c => c.column.col_key === col.col_key)
                          return (
                            <div key={col.col_key} className="space-y-1">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!checked}
                                  onChange={() => toggleColumn(col)}
                                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                />
                                <span className="text-[13px] text-gray-700">{col.name}</span>
                                <span className="text-[11px] text-gray-400">({col.kind})</span>
                              </label>
                              {checked && (
                                <input
                                  type="text"
                                  value={checked.customName}
                                  onChange={e => updateColumnName(col.col_key, e.target.value)}
                                  placeholder="Nombre en sub-items"
                                  className="ml-6 w-full text-[13px] px-2 py-1 rounded border border-gray-200 focus:border-indigo-400 outline-none bg-gray-50 focus:bg-white transition-colors"
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Manual columns */}
                    {manualCols.length > 0 && (
                      <div>
                        <div className="text-[13px] font-semibold text-gray-700 mb-2">Columnas manuales</div>
                        <div className="space-y-2">
                          {manualCols.map(manual => (
                            <div key={manual.tempId} className="flex items-end gap-2">
                              <div className="flex-1 space-y-1">
                                <input
                                  type="text"
                                  value={manual.name}
                                  onChange={e => updateManualColumn(manual.tempId, 'name', e.target.value)}
                                  placeholder="Nombre"
                                  className="w-full text-[13px] px-2 py-1 rounded border border-gray-200 focus:border-indigo-400 outline-none bg-gray-50 focus:bg-white transition-colors"
                                />
                                <select
                                  value={manual.kind}
                                  onChange={e => updateManualColumn(manual.tempId, 'kind', e.target.value)}
                                  className="w-full text-[13px] px-2 py-1 rounded border border-gray-200 focus:border-indigo-400 outline-none bg-gray-50 focus:bg-white transition-colors"
                                >
                                  <option value="text">Texto</option>
                                  <option value="number">Número</option>
                                  <option value="formula">Fórmula</option>
                                </select>
                              </div>
                              <button
                                onClick={() => removeManualColumn(manual.tempId)}
                                className="px-2 py-1 text-[12px] text-red-600 hover:bg-red-50 rounded transition-colors flex-none"
                              >
                                Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add manual column button */}
                    <button
                      onClick={addManualColumn}
                      className="w-full py-2 text-[13px] text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
                    >
                      + Agregar columna manual
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100">
            {step === 'columns' && (
              <button
                onClick={handleBack}
                disabled={saving}
                className="px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Atrás
              </button>
            )}
            <div className="flex-1" />
            {step === 'board' && (
              <button
                onClick={handleGoToColumns}
                disabled={saving || !selectedBoardId}
                className="px-4 py-1.5 text-[13px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                Siguiente →
              </button>
            )}
            {step === 'columns' && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 text-[13px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
