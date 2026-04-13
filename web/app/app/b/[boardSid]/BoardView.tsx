'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GenericDataTable } from '@/components/data-table/GenericDataTable'
import { InlineSubItems } from '@/components/InlineSubItems'
import { SourceColumnMapper } from '@/components/SourceColumnMapper'
import { ImportWizard } from '@/components/import/ImportWizard'
import type { ColumnDef, Row, CellValue, CellKind, ColumnSettings } from '@/components/data-table/types'
import type { BoardStage, BoardColumn, WorkspaceUser, BoardItem, ItemValue, SubItemColumn } from '@/lib/boards'

// System col_keys that map directly to items table fields
const ITEMS_FIELD: Record<string, keyof BoardItem> = {
  name:     'name',
  stage:    'stage_id',
  owner:    'owner_id',
  deadline: 'deadline',
}

// Virtual sid column (prepended, not in board_columns)
const SID_COL: ColumnDef = {
  key:      '__sid',
  label:    'ID',
  kind:     'autonumber',
  editable: false,
  sortable: false,
  settings: {},
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  boardId:               string
  boardSid:              number
  boardName:             string
  initialStages:         BoardStage[]
  initialColumns:        BoardColumn[]
  initialUsers:          WorkspaceUser[]
  initialItems:          BoardItem[]
  initialSubItemColumns: SubItemColumn[]
  initialSourceBoardId:  string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoardView({
  boardId, boardSid, boardName,
  initialStages, initialColumns, initialUsers, initialItems,
  initialSubItemColumns, initialSourceBoardId,
}: Props) {
  const router = useRouter()

  // All data pre-fetched by server — no loading state, no useEffect
  const [rawCols,  setRawCols]  = useState<BoardColumn[]>(initialColumns)
  const [stages,   setStages]   = useState<BoardStage[]>(initialStages)
  const [users,    setUsers]    = useState<WorkspaceUser[]>(initialUsers)
  const [rawItems, setRawItems] = useState<BoardItem[]>(initialItems)
  const [subItemColumns, setSubItemColumns] = useState<SubItemColumn[]>(initialSubItemColumns)
  const [sourceBoardId, setSourceBoardId]   = useState<string | null>(initialSourceBoardId)
  const [showMapper,    setShowMapper]       = useState(false)
  const [showImport,    setShowImport]       = useState(false)

  // col_key → column UUID  (for item_values lookups)
  const colIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    rawCols.forEach(c => { map[c.col_key] = c.id })
    return map
  }, [rawCols])

  // ColumnDef[] — virtual __sid first, then board columns
  const columns = useMemo((): ColumnDef[] => {
    const dataCols: ColumnDef[] = rawCols
      .filter(c => !c.is_hidden)
      .map(c => ({
        key:      c.col_key,
        label:    c.name,
        kind:     c.kind as CellKind,
        sticky:   c.col_key === 'name',
        editable: c.kind !== 'autonumber',
        sortable: true,
        settings: augmentSettings(c, stages, users),
      }))
    return [SID_COL, ...dataCols]
  }, [rawCols, stages, users])

  // Row[] — derived from rawItems + columns
  const rows = useMemo((): Row[] => {
    if (rawCols.length === 0) return []
    return rawItems.map(item => toRow(item, colIdMap, columns))
  }, [rawItems, colIdMap, columns, rawCols.length])

  // ── Cell change ────────────────────────────────────────────────────────────
  const handleCellChange = useCallback(async (rowId: string, colKey: string, value: CellValue) => {
    if (colKey === '__sid') return

    // Optimistic update
    setRawItems(prev => prev.map(item => {
      if (item.id !== rowId) return item
      if (colKey in ITEMS_FIELD) {
        return { ...item, [ITEMS_FIELD[colKey]]: value }
      }
      const colId = colIdMap[colKey]
      if (!colId) return item
      const updated: ItemValue = {
        column_id:    colId,
        value_text:   typeof value === 'string' ? value : null,
        value_number: typeof value === 'number' ? value : null,
        value_date:   null,
        value_json:   Array.isArray(value) || typeof value === 'boolean' ? value : null,
      }
      const existing = item.item_values.find(v => v.column_id === colId)
      return {
        ...item,
        item_values: existing
          ? item.item_values.map(v => v.column_id === colId ? updated : v)
          : [...item.item_values, updated],
      }
    }))

    // Persist
    if (colKey in ITEMS_FIELD) {
      const field = ITEMS_FIELD[colKey]
      await fetch(`/api/items/${rowId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: value }),
      })
    } else {
      const colId = colIdMap[colKey]
      if (!colId) return
      await fetch(`/api/items/${rowId}/values`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ column_id: colId, value }),
      })
    }
  }, [colIdMap])

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleNew = async () => {
    const res = await fetch('/api/items', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ board_id: boardId, name: 'Nuevo registro' }),
    })
    if (!res.ok) return
    const item = await res.json() as BoardItem
    setRawItems(prev => [...prev, { ...item, item_values: [] }])
  }

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async (ids: string[]) => {
    setRawItems(prev => prev.filter(i => !ids.includes(i.id)))
    await fetch('/api/items/bulk', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids }),
    })
  }

  // ── Inline sub-items expansion ────────────────────────────────────────────
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  const handleExpandSubItems = useCallback((rowId: string) => {
    setExpandedItemId(prev => prev === rowId ? null : rowId)
  }, [])

  // Update sub_items_count when inline panel changes it
  const handleSubItemCountChange = useCallback((itemId: string, count: number) => {
    setRawItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, sub_items_count: count } : i
    ))
  }, [])

  // ── Open item detail ───────────────────────────────────────────────────────
  const handleOpenItem = useCallback((rowId: string) => {
    const item = rawItems.find(i => i.id === rowId)
    if (!item?.sid) return
    router.push(`/app/b/${boardSid}/${item.sid}`)
  }, [rawItems, boardSid, router])

  // ── Refresh items + columns after import (new columns may have been created) ─
  const refreshAll = useCallback(async () => {
    const [itemsRes, colsRes] = await Promise.all([
      fetch(`/api/items?boardId=${boardId}`),
      fetch(`/api/boards/${boardId}/columns`),
    ])
    if (itemsRes.ok) setRawItems(await itemsRes.json() as BoardItem[])
    if (colsRes.ok)  setRawCols(await colsRes.json() as BoardColumn[])
  }, [boardId])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 flex-none">
        <h1 className="text-[14px] font-semibold text-gray-800">{boardName}</h1>
        <div className="flex-1" />
        <button
          onClick={() => setShowMapper(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] border rounded-md transition-colors ${
            sourceBoardId
              ? 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
              : 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100'
          }`}
        >
          {sourceBoardId ? (
            <>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none">
                <path d="M2 6l3 3 5-5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Catálogo de sub-items listo · Cambiar
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none">
                <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Elige un catálogo para los sub-items
            </>
          )}
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
            <path d="M6 1v7M3 5l3 3 3-3M1 10h10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Importar
        </button>
        <span className="text-[12px] text-gray-400">
          {rows.length} registro{rows.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          <span className="text-[15px] leading-none">+</span> Nuevo
        </button>
      </div>

      {/* Table with inline expansion */}
      <div className="flex-1 overflow-hidden">
        <GenericDataTable
          columns={columns}
          rows={rows}
          onCellChange={handleCellChange}
          onExpandSubItems={handleExpandSubItems}
          expandedSubItemId={expandedItemId}
          renderRowExpansion={(rowId) => (
            <InlineSubItems
              itemId={rowId}
              boardId={boardId}
              subItemColumns={subItemColumns}
              sourceBoardId={sourceBoardId}
              onCountChange={(count) => handleSubItemCountChange(rowId, count)}
            />
          )}
          onOpenItem={handleOpenItem}
          onBulkDelete={handleBulkDelete}
          loading={false}
        />
      </div>

      {/* SourceColumnMapper modal */}
      {showMapper && (
        <SourceColumnMapper
          boardId={boardId}
          currentSourceBoardId={sourceBoardId}
          currentColumns={subItemColumns}
          onClose={() => setShowMapper(false)}
          onSaved={(newSourceId, newCols) => {
            setSourceBoardId(newSourceId)
            setSubItemColumns(newCols)
            setShowMapper(false)
          }}
        />
      )}

      {/* ImportWizard modal */}
      {showImport && (
        <ImportWizard
          boardId={boardId}
          boardColumns={rawCols}
          onClose={() => setShowImport(false)}
          onImported={async (_count) => {
            setShowImport(false)
            await refreshAll()
          }}
        />
      )}
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

function toRow(item: BoardItem, colIdMap: Record<string, string>, cols: ColumnDef[]): Row {
  const cells: Record<string, CellValue> = {}
  for (const col of cols) {
    if (col.key === '__sid') {
      cells[col.key] = item.sid
    } else if (col.key in ITEMS_FIELD) {
      cells[col.key] = (item[ITEMS_FIELD[col.key]] ?? null) as CellValue
    } else {
      const colId = colIdMap[col.key]
      const v = item.item_values?.find(iv => iv.column_id === colId)
      cells[col.key] = v
        ? (v.value_text ?? v.value_number ?? v.value_date ?? (v.value_json !== null ? v.value_json as CellValue : null))
        : null
    }
  }
  const count = item.sub_items_count ?? 0
  return { id: item.id, sid: item.sid, cells, hasSubItems: count > 0, subItemsCount: count }
}
