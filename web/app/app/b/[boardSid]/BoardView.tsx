'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GenericDataTable } from '@/components/data-table/GenericDataTable'
import { InlineSubItems, type SubItemLevels } from '@/components/InlineSubItems'
import type { ColumnDef, Row, CellValue, CellKind, ColumnSettings } from '@/components/data-table/types'
import type { BoardStage, BoardColumn, WorkspaceUser, BoardItem, ItemValue } from '@/lib/boards'

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
  boardId:        string
  boardSid:       number
  boardName:      string
  initialStages:  BoardStage[]
  initialColumns: BoardColumn[]
  initialUsers:   WorkspaceUser[]
  initialItems:   BoardItem[]
  levels?:        SubItemLevels   // configurable per board (Phase 8); defaults used if omitted
  catalogBoardId?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_LEVELS: SubItemLevels = { l1: 'Sub-item', l2: 'Variante' }

export function BoardView({
  boardId, boardSid, boardName,
  initialStages, initialColumns, initialUsers, initialItems,
  levels = DEFAULT_LEVELS,
  catalogBoardId = null,
}: Props) {
  const router = useRouter()

  // All data pre-fetched by server — no loading state, no useEffect
  const [rawCols,  setRawCols]  = useState<BoardColumn[]>(initialColumns)
  const [stages,   setStages]   = useState<BoardStage[]>(initialStages)
  const [users,    setUsers]    = useState<WorkspaceUser[]>(initialUsers)
  const [rawItems, setRawItems] = useState<BoardItem[]>(initialItems)

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 flex-none">
        <h1 className="text-[14px] font-semibold text-gray-800">{boardName}</h1>
        <div className="flex-1" />
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
              levels={levels}
              catalogBoardId={catalogBoardId}
              onCountChange={(count) => handleSubItemCountChange(rowId, count)}
            />
          )}
          onOpenItem={handleOpenItem}
          onBulkDelete={handleBulkDelete}
          loading={false}
        />
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
