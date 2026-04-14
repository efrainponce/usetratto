'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ColumnCell } from '@/components/data-table/cells/ColumnCell'
import { SubItemsView } from '@/components/SubItemsView'
import { ItemChannels } from '@/components/ItemChannels'
import { ActivityFeed } from '@/components/ActivityFeed'
import type { ColumnDef, CellValue, CellKind, ColumnSettings, NavDirection } from '@/components/data-table/types'
import type { BoardStage, BoardColumn, WorkspaceUser, BoardItem, ItemValue, SubItemColumn } from '@/lib/boards'

// System col_keys that map directly to items table fields
const ITEMS_FIELD: Record<string, keyof BoardItem> = {
  name:     'name',
  stage:    'stage_id',
  owner:    'owner_id',
  deadline: 'deadline',
}

type Tab = 'subitems' | 'channels' | 'activity'

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  boardId:               string
  boardSid:              number
  boardName:             string
  initialStages:         BoardStage[]
  initialColumns:        BoardColumn[]
  initialUsers:          WorkspaceUser[]
  initialItem:           BoardItem
  initialSubItemColumns: SubItemColumn[]
  initialSourceBoardId:  string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ItemDetailView({
  boardId, boardSid, boardName,
  initialStages, initialColumns, initialUsers, initialItem, initialSubItemColumns, initialSourceBoardId,
}: Props) {
  // All data pre-fetched by server — instant render, no loading state
  const [item,             setItem]             = useState<BoardItem>(initialItem)
  const [stages]                                = useState<BoardStage[]>(initialStages)
  const [users]                                 = useState<WorkspaceUser[]>(initialUsers)
  const [rawCols]                               = useState<BoardColumn[]>(initialColumns)
  const [subItemColumns]                        = useState<SubItemColumn[]>(initialSubItemColumns)
  const [sourceBoardId]                         = useState<string | null>(initialSourceBoardId)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [activeTab,  setActiveTab]  = useState<Tab>('subitems')

  // ── Derived ───────────────────────────────────────────────────────────────

  const colIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    rawCols.forEach(c => { map[c.col_key] = c.id })
    return map
  }, [rawCols])

  const columns = useMemo((): ColumnDef[] =>
    rawCols
      .filter(c => !c.is_hidden)
      .map(c => ({
        id:       c.id,
        key:      c.col_key,
        label:    c.name,
        kind:     c.kind as CellKind,
        editable: c.kind !== 'autonumber' && c.kind !== 'button',
        settings: augmentSettings(c, stages, users),
      })),
    [rawCols, stages, users]
  )

  // Info panel: all columns except name (shown in header)
  const infoColumns = useMemo(() => columns.filter(c => c.key !== 'name'), [columns])

  // Current stage for badge
  const currentStage = useMemo(() => {
    if (!item.stage_id) return null
    return stages.find(s => s.id === item.stage_id) ?? null
  }, [item.stage_id, stages])

  // ── Cell value helper ─────────────────────────────────────────────────────

  const getFieldValue = useCallback((colKey: string): CellValue => {
    if (colKey in ITEMS_FIELD) return (item[ITEMS_FIELD[colKey]] ?? null) as CellValue
    const colId = colIdMap[colKey]
    if (!colId) return null
    const v = item.item_values?.find(iv => iv.column_id === colId)
    if (!v) return null
    return v.value_text ?? v.value_number ?? v.value_date ?? (v.value_json !== null ? v.value_json as CellValue : null)
  }, [item, colIdMap])

  // ── Cell change ───────────────────────────────────────────────────────────

  const handleCellChange = useCallback(async (colKey: string, value: CellValue) => {
    // Optimistic update
    setItem(prev => {
      if (colKey in ITEMS_FIELD) return { ...prev, [ITEMS_FIELD[colKey]]: value }
      const colId = colIdMap[colKey]
      if (!colId) return prev
      const updated: ItemValue = {
        column_id:    colId,
        value_text:   typeof value === 'string'  ? value : null,
        value_number: typeof value === 'number'  ? value : null,
        value_date:   null,
        value_json:   Array.isArray(value) || typeof value === 'boolean' ? value : null,
      }
      const existing = prev.item_values.find(v => v.column_id === colId)
      return {
        ...prev,
        item_values: existing
          ? prev.item_values.map(v => v.column_id === colId ? updated : v)
          : [...prev.item_values, updated],
      }
    })

    // Persist
    if (colKey in ITEMS_FIELD) {
      await fetch(`/api/items/${item.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [ITEMS_FIELD[colKey]]: value }),
      })
    } else {
      const colId = colIdMap[colKey]
      if (!colId) return
      await fetch(`/api/items/${item.id}/values`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ column_id: colId, value }),
      })
    }
  }, [item.id, colIdMap])

  // ── Field navigation (Tab / Shift+Tab) ────────────────────────────────────

  const handleNavigate = useCallback((colKey: string, dir: NavDirection) => {
    const idx = infoColumns.findIndex(c => c.key === colKey)
    if (dir === 'tab' || dir === 'enter') {
      const next = infoColumns[idx + 1]
      setEditTarget(next ? next.key : null)
    } else if (dir === 'shifttab') {
      const prev = infoColumns[idx - 1]
      setEditTarget(prev ? prev.key : null)
    } else {
      setEditTarget(null)
    }
  }, [infoColumns])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar: breadcrumb ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-none text-[13px]">
        <Link
          href={`/app/b/${boardSid}`}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-current">
            <path d="M10 12L6 8l4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {boardName}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">#{item.sid}</span>
      </div>

      {/* ── Item header: name + stage badge ─────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-none">
        <div className="flex-1 min-w-0">
          {editTarget === '__name' ? (
            <input
              autoFocus
              defaultValue={item.name}
              className="w-full text-[20px] font-semibold text-gray-900 bg-transparent border-b border-indigo-400 outline-none pb-0.5"
              onBlur={e => { handleCellChange('name', e.target.value); setEditTarget(null) }}
              onKeyDown={e => {
                if (e.key === 'Enter')  { handleCellChange('name', e.currentTarget.value); setEditTarget(null) }
                if (e.key === 'Escape') setEditTarget(null)
              }}
            />
          ) : (
            <h1
              className="text-[20px] font-semibold text-gray-900 cursor-text hover:text-indigo-600 transition-colors truncate"
              onClick={() => setEditTarget('__name')}
            >
              {item.name || '(Sin nombre)'}
            </h1>
          )}
        </div>
        {currentStage && (
          <span
            className="flex-none text-[12px] font-medium px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: currentStage.color ?? '#94a3b8' }}
          >
            {currentStage.name}
          </span>
        )}
      </div>

      {/* ── Main: info panel + tabs ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Info panel ──────────────────────────────────────────────── */}
        <div className="w-72 flex-none border-r border-gray-100 overflow-y-auto px-4 py-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Información
          </p>
          <div className="space-y-0.5">
            {infoColumns.map(col => (
              <div key={col.key} className="flex items-start gap-2 py-0.5">
                <span className="w-24 flex-none text-[12px] text-gray-500 pt-1.5 truncate select-none">
                  {col.label}
                </span>
                <div className="flex-1 min-w-0 rounded hover:bg-gray-50 transition-colors">
                  <ColumnCell
                    column={col}
                    value={getFieldValue(col.key)}
                    isEditing={editTarget === col.key}
                    rowId={item.id}
                    onStartEdit={() => setEditTarget(col.key)}
                    onCommit={val => { handleCellChange(col.key, val); setEditTarget(null) }}
                    onCancel={() => setEditTarget(null)}
                    onNavigate={dir => handleNavigate(col.key, dir)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs area ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-gray-100 px-4 flex-none">
            {(['subitems', 'channels', 'activity'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'subitems' ? 'Sub-items' : tab === 'channels' ? 'Canales' : 'Actividad'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {activeTab === 'subitems' && (
              <SubItemsView
                itemId={item.id}
                boardId={boardId}
                subItemColumns={subItemColumns}
                sourceBoardId={sourceBoardId}
              />
            )}
            {activeTab === 'channels' && (
              <ItemChannels
                itemId={item.id}
                workspaceUsers={users}
              />
            )}
            {activeTab === 'activity' && (
              <ActivityFeed itemId={item.id} />
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function augmentSettings(col: BoardColumn, stages: BoardStage[], users: WorkspaceUser[]): ColumnSettings {
  const base = (col.settings ?? {}) as ColumnSettings
  if (col.col_key === 'stage') {
    return {
      ...base,
      options: stages
        .slice().sort((a, b) => a.position - b.position)
        .map(s => ({ value: s.id, label: s.name, color: s.color ?? '#94a3b8' })),
    }
  }
  if (col.col_key === 'owner') {
    return {
      ...base,
      options: users.map(u => ({ value: u.id, label: u.name ?? u.phone ?? 'Usuario' })),
    }
  }
  return base
}
