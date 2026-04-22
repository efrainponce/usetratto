'use client'

import { useEffect, useRef, useState } from 'react'
import { ColumnSettingsPanel, type PanelUser } from '../ColumnSettingsPanel'
import type { SubItemData } from '@/lib/boards/types'
import type { SubItemColumn } from './types'

type Props = {
  row:            SubItemData
  columns:        SubItemColumn[]
  boardId:        string
  users?:         PanelUser[]
  computeFormula: (col: SubItemColumn, row: SubItemData) => number | null
  onCommit:       (field: string, value: unknown) => void
  onColUpdated:   (updated: SubItemColumn) => void
  onColDeleted:   (colId: string) => void
  onClose:        () => void
  isBoardAdmin?:  boolean
}

export function SubItemDetailDrawer({
  row, columns, boardId, users, computeFormula, onCommit, onColUpdated, onColDeleted, onClose, isBoardAdmin,
}: Props) {
  const [localName,    setLocalName]    = useState(row.name)
  const [editingName,  setEditingName]  = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [colSettings,  setColSettings]  = useState<SubItemColumn | null>(null)

  useEffect(() => { setLocalName(row.name) }, [row.name])

  const estadoCol  = columns.find(c => c.kind === 'select')
  const estadoVal  = estadoCol ? row.values.find(v => v.column_id === estadoCol.id)?.value_text ?? null : null
  const estadoOpts = estadoCol ? (estadoCol.settings.options as { value: string; label: string; color: string }[] | undefined) ?? [] : []
  const estadoOpt  = estadoOpts.find(o => o.value === estadoVal)

  const displayCols = columns.filter(c => !c.is_hidden && c.kind !== 'formula')
  const formulaCols = columns.filter(c => !c.is_hidden && c.kind === 'formula')

  const getVal = (col: SubItemColumn) => {
    const v = row.values.find(v => v.column_id === col.id)
    return col.kind === 'number' ? (v?.value_number ?? '') : (v?.value_text ?? '')
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-none">
          <span className="text-[11px] font-mono text-gray-400">#{row.sid}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
              <path d="M2 2l10 10M12 2L2 12" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-none">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                autoFocus
                defaultValue={localName}
                className="w-full text-[17px] font-semibold text-gray-900 bg-transparent border-b border-indigo-400 outline-none pb-0.5"
                onBlur={e => { const v = e.target.value; setLocalName(v); if (v !== row.name) onCommit('name', v); setEditingName(false) }}
                onKeyDown={e => {
                  if (e.key === 'Enter')  { e.currentTarget.blur() }
                  if (e.key === 'Escape') { setLocalName(row.name); setEditingName(false) }
                }}
              />
            ) : (
              <h2
                className="text-[17px] font-semibold text-gray-900 cursor-text hover:text-indigo-600 transition-colors truncate"
                onClick={() => setEditingName(true)}
              >
                {localName || '(Sin nombre)'}
              </h2>
            )}
          </div>
          {estadoOpt && (
            <span
              className="flex-none text-[11px] font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: estadoOpt.color ?? '#94a3b8' }}
            >
              {estadoOpt.label}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Información</p>
          <div className="space-y-0.5">
            {displayCols.map(col => {
              const raw  = getVal(col)
              const opts = col.kind === 'select'
                ? (col.settings.options as { value: string; color: string }[] | undefined) ?? []
                : undefined
              const fieldKind: 'text' | 'number' | 'select' =
                col.kind === 'number' ? 'number' : col.kind === 'select' ? 'select' : 'text'
              return (
                <div key={col.id} className="group/dfield flex items-start gap-2 py-0.5">
                  <div className="w-20 flex-none flex items-center gap-0.5 pt-1.5">
                    <span className="flex-1 text-[12px] text-gray-500 truncate select-none">{col.name}</span>
                    {isBoardAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); setColSettings(col) }}
                        className="opacity-0 group-hover/dfield:opacity-100 shrink-0 text-[13px] leading-none text-gray-400 hover:text-indigo-500 transition-opacity px-0.5"
                      >⋯</button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 rounded hover:bg-gray-50 transition-colors">
                    <DrawerEditField
                      value={raw}
                      kind={fieldKind}
                      options={opts}
                      editing={editingField === col.id}
                      onStart={() => setEditingField(col.id)}
                      onCommit={v => { onCommit(col.id, v); setEditingField(null) }}
                      onCancel={() => setEditingField(null)}
                    />
                  </div>
                </div>
              )
            })}

            {formulaCols.map(col => {
              const result = computeFormula(col, row)
              return (
                <div key={col.id} className="flex items-start gap-2 py-0.5">
                  <span className="w-20 flex-none text-[12px] text-gray-500 pt-1.5 truncate select-none">{col.name}</span>
                  <div className="flex-1 min-w-0 text-[13px] text-indigo-700 font-semibold px-2 py-1.5 bg-indigo-50 rounded">
                    {result != null
                      ? result.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                      : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {colSettings && (
        <ColumnSettingsPanel
          column={{ ...colSettings, is_system: colSettings.is_system ?? false }}
          boardId={boardId}
          allColumns={columns.map(c => ({ col_key: c.col_key, name: c.name, kind: c.kind, settings: (c.settings as Record<string, unknown>) ?? {} }))}
          users={users ?? []}
          patchEndpoint={`/api/sub-item-columns/${colSettings.id}`}
          permissionsEndpoint={`/api/sub-item-columns/${colSettings.id}/permissions`}
          onClose={() => setColSettings(null)}
          onPatched={updated => { onColUpdated(updated as unknown as SubItemColumn) }}
          onUpdated={updated => { onColUpdated(updated as unknown as SubItemColumn); setColSettings(null) }}
          onDeleted={colId => { onColDeleted(colId); setColSettings(null) }}
        />
      )}
    </>
  )
}

type FieldProps = {
  value:    string | number
  kind:     'text' | 'number' | 'select'
  editing:  boolean
  onStart:  () => void
  onCommit: (v: string | number) => void
  onCancel: () => void
  options?: { value: string; color: string }[]
}

function DrawerEditField({ value, kind, editing, onStart, onCommit, onCancel, options }: FieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing && kind !== 'select') inputRef.current?.select() }, [editing, kind])

  if (editing) {
    if (kind === 'select') {
      return (
        <select
          autoFocus defaultValue={String(value)}
          className="mt-1 w-full text-[13px] border border-indigo-400 rounded px-2 py-1.5 outline-none bg-white"
          onChange={e  => onCommit(e.target.value)}
          onBlur={e    => onCommit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        >
          <option value="">—</option>
          {(options ?? []).map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
        </select>
      )
    }
    return (
      <input
        ref={inputRef} autoFocus defaultValue={String(value)}
        type={kind === 'number' ? 'number' : 'text'}
        className="mt-1 w-full text-[13px] border border-indigo-400 rounded px-2 py-1.5 outline-none"
        onBlur={e => onCommit(kind === 'number' ? Number(e.target.value) : e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  onCommit(kind === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)
          if (e.key === 'Escape') onCancel()
        }}
      />
    )
  }

  if (kind === 'select') {
    const opt = (options ?? []).find(o => o.value === value)
    return (
      <div onClick={onStart} className="mt-1 cursor-pointer">
        {opt
          ? <span className="text-[12px] font-medium px-2 py-1 rounded-full text-white" style={{ backgroundColor: opt.color }}>{opt.value}</span>
          : <span className="text-[13px] text-gray-300 px-2 py-1.5 block hover:bg-gray-50 rounded border border-transparent hover:border-gray-200">—</span>}
      </div>
    )
  }

  const empty = value === '' || value == null
  return (
    <div
      onClick={onStart}
      className={`mt-1 text-[13px] px-2 py-1.5 rounded border border-transparent hover:border-gray-200 cursor-text transition-colors ${empty ? 'text-gray-300 italic' : 'text-gray-800'}`}
    >
      {empty ? '—' : value}
    </div>
  )
}
