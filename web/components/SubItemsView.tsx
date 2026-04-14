'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { ProductPicker } from './ProductPicker'

// ─── Sub-item view types ──────────────────────────────────────────────────────

type SubItemView = {
  id:       string
  sid:      number
  name:     string
  position: number
  type:     'native' | 'board_items' | 'board_sub_items'
  config:   Record<string, unknown>
}

type SubItemColumn = {
  id: string; col_key: string; name: string; kind: string
  position: number; is_hidden: boolean; required: boolean
  settings: Record<string, unknown>; source_col_key: string | null
}

type BoardColumn = {
  id: string; col_key: string; name: string; kind: string
  position: number; is_hidden: boolean; settings: Record<string, unknown>
}

type SubItemValue = {
  column_id: string; col_key: string
  value_text: string | null; value_number: number | null
  value_date: string | null; value_json: unknown
}

type SubItemData = {
  id: string; sid: number; parent_id: string | null; depth: number
  name: string; position: number; source_item_id: string | null
  values: SubItemValue[]
  children?: SubItemData[]
}

type SourceItem = {
  id: string; sid: number; name: string; stage_id: string | null
  item_values?: { column_id: string; value_text: string | null; value_number: number | null; value_date: string | null; value_json: unknown }[]
}

type NativeData      = { kind: 'native';          columns: SubItemColumn[]; items: SubItemData[] }
type BoardItemsData  = { kind: 'board_items';      source_board_id: string; source_board_sid: number | null; source_board_name: string; columns: BoardColumn[];  items: SourceItem[] }
type BoardSubData    = { kind: 'board_sub_items';  source_board_id: string; columns: SubItemColumn[]; items: SubItemData[] }
type ViewData        = NativeData | BoardItemsData | BoardSubData

type EditTarget = { id: string; field: string } | null

// ─── Shell ────────────────────────────────────────────────────────────────────

type Props = {
  itemId:              string
  boardId:             string
  views:               SubItemView[]
  onCountChange?:      (count: number) => void
  onAddView?:          () => void
  onConfigureColumns?: () => void
  compact?:            boolean
  columnsVersion?:     number
  boardSettings?:      Record<string, unknown>
  subitemView?:        'L1_only' | 'L1_L2' | 'L2_only'
}

export function SubItemsView({ itemId, boardId, views, onCountChange, onAddView, onConfigureColumns, compact, columnsVersion, boardSettings, subitemView }: Props) {
  const [activeViewId, setActiveViewId] = useState<string>(views[0]?.id ?? '')
  const activeView = views.find(v => v.id === activeViewId) ?? views[0]

  if (!activeView) {
    return (
      <div className="flex items-center justify-center h-full text-[13px] text-gray-400 italic">
        Sin vistas configuradas
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── View tabs ────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-gray-100 px-3 flex-none gap-0.5">
        {views.map(v => {
          const isActive = activeViewId === v.id
          return (
            <div key={v.id} className="flex items-center group/tab -mb-px">
              <button
                onClick={() => setActiveViewId(v.id)}
                className={`px-2.5 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.name}
                {v.type !== 'native' && (
                  <span className="ml-1.5 text-[10px] text-blue-400 font-normal">ref</span>
                )}
              </button>
              {/* ⚙ config button — only on active native tab */}
              {isActive && v.type === 'native' && onConfigureColumns && (
                <button
                  onClick={onConfigureColumns}
                  title="Configurar columnas"
                  className="text-gray-400 hover:text-indigo-600 transition-colors p-0.5 rounded"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current">
                    <path d="M2 4h8M2 8h5" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="9" cy="8" r="1.5" strokeWidth="1.3"/>
                    <circle cx="5" cy="4" r="1.5" strokeWidth="1.3"/>
                  </svg>
                </button>
              )}
            </div>
          )
        })}
        {/* + new view */}
        {onAddView && (
          <button
            onClick={onAddView}
            title="Nueva vista"
            className="ml-1 px-2 py-1.5 text-[12px] text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px]">Vista</span>
          </button>
        )}
      </div>

      {/* ── Renderer ─────────────────────────────────────────────────────── */}
      {activeView.type === 'native' && (
        <NativeRenderer
          key={`${activeView.id}-${columnsVersion ?? 0}`}
          itemId={itemId}
          boardId={boardId}
          viewId={activeView.id}
          config={activeView.config}
          onCountChange={onCountChange}
          compact={compact}
          boardSettings={boardSettings}
          subitemView={subitemView}
        />
      )}
      {activeView.type === 'board_items' && (
        <BoardItemsRenderer key={activeView.id} itemId={itemId} viewId={activeView.id} viewName={activeView.name} compact={compact} />
      )}
      {activeView.type === 'board_sub_items' && (
        <BoardSubItemsRenderer key={activeView.id} itemId={itemId} viewId={activeView.id} viewName={activeView.name} compact={compact} />
      )}
    </div>
  )
}

// ─── NativeRenderer ───────────────────────────────────────────────────────────
// Snapshot mode: shows sub_items belonging to this item.
// config.source_board_id → ProductPicker (snapshot from another board).
// Without source_board_id → manual add form.

function NativeRenderer({
  itemId, boardId, viewId, config, onCountChange, compact, boardSettings, subitemView,
}: {
  itemId:          string
  boardId:         string
  viewId:          string
  config:          Record<string, unknown>
  onCountChange?:  (count: number) => void
  compact?:        boolean
  boardSettings?:  Record<string, unknown>
  subitemView?:    'L1_only' | 'L1_L2' | 'L2_only'
}) {
  const sourceBoardId = (config.source_board_id as string) ?? null

  const [rows,         setRows]         = useState<SubItemData[]>([])
  const [columns,      setColumns]      = useState<SubItemColumn[]>([])
  const [loading,      setLoading]      = useState(true)
  const [expandedL1,   setExpandedL1]   = useState<Set<string>>(new Set())
  const [editTarget,   setEditTarget]   = useState<EditTarget>(null)
  const [showPicker,   setShowPicker]   = useState(false)
  const [addingL2For,  setAddingL2For]  = useState<string | null>(null)
  const [addingCol,    setAddingCol]    = useState(false)
  const [openDetailId, setOpenDetailId] = useState<string | null>(null)

  const onCountChangeRef = useRef(onCountChange)
  useEffect(() => { onCountChangeRef.current = onCountChange })
  useEffect(() => { onCountChangeRef.current?.(rows.length) }, [rows.length])

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/sub-item-views/${viewId}/data?itemId=${itemId}`)
      const data = (await res.json()) as NativeData

      setColumns(data.columns ?? [])
      setRows(data.items ?? [])
    } catch (e) {
      console.error('[NativeRenderer] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [viewId, itemId])

  useEffect(() => { load() }, [load])

  // ── Auto-expand L2_only ────────────────────────────────────────────────────

  useEffect(() => {
    if (subitemView === 'L2_only') {
      setExpandedL1(new Set(rows.map(r => r.id)))
    }
  }, [subitemView, rows])

  // ── Create L1 ──────────────────────────────────────────────────────────────

  const createL1 = useCallback(async (name: string, source_item_id?: string) => {
    if (!name.trim()) return
    try {
      const res = await fetch('/api/sub-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, name: name.trim(), depth: 0, source_item_id: source_item_id ?? null }),
      })
      if (!res.ok) { console.error('[NativeRenderer] createL1 failed:', res.status, await res.text()); return }
      const created = (await res.json()) as SubItemData
      if (!created?.id) return
      setRows(prev => [...prev, { ...created, children: [] }])
    } catch (e) {
      console.error('[NativeRenderer] createL1 error:', e)
    }
  }, [itemId])

  // ── Create L2 ──────────────────────────────────────────────────────────────

  const createL2 = useCallback(async (parentId: string, name: string) => {
    if (!name.trim()) return
    try {
      const res = await fetch('/api/sub-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, parent_id: parentId, name: name.trim(), depth: 1 }),
      })
      if (!res.ok) { console.error('[NativeRenderer] createL2 failed:', res.status, await res.text()); return }
      const created = (await res.json()) as SubItemData
      if (!created?.id) return
      setRows(prev => prev.map(r =>
        r.id === parentId ? { ...r, children: [...(r.children ?? []), created] } : r
      ))
      setExpandedL1(s => new Set([...s, parentId]))
      setAddingL2For(null)
    } catch (e) {
      console.error('[NativeRenderer] createL2 error:', e)
    }
  }, [itemId])

  // ── Edit ───────────────────────────────────────────────────────────────────

  const editField = useCallback(async (id: string, field: string, value: unknown) => {
    setEditTarget(null)
    setRows(prev => patchTree(prev, id, field === 'name' ? { name: value as string } : {}))
    try {
      if (field === 'name') {
        await fetch(`/api/sub-items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: value }) })
      } else {
        await fetch(`/api/sub-items/${id}/values`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column_id: field, value }) })
      }
    } catch (e) {
      console.error('[NativeRenderer] editField error:', e)
      load()
    }
  }, [load])

  // ── Delete ─────────────────────────────────────────────────────────────────

  const remove = useCallback(async (id: string, depth: number, parentId: string | null) => {
    if (depth === 0) setRows(prev => prev.filter(r => r.id !== id))
    else setRows(prev => prev.map(r => r.id === parentId ? { ...r, children: (r.children ?? []).filter(c => c.id !== id) } : r))
    try {
      await fetch(`/api/sub-items/${id}`, { method: 'DELETE' })
    } catch (e) {
      console.error('[NativeRenderer] remove error:', e)
      load()
    }
  }, [load])

  // ── Expand variants ────────────────────────────────────────────────────────

  const expandVariants = useCallback(async (parentId: string) => {
    const dims = boardSettings?.variant_dimensions as string[] | undefined
    if (!dims || dims.length === 0) return

    try {
      const res = await fetch(`/api/sub-items/${parentId}/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_ids: dims }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        console.error('[NativeRenderer] expand failed:', err.error ?? res.status)
        alert(err.error ?? 'Error al explotar variantes')
        return
      }
      const { created } = (await res.json()) as { created: SubItemData[]; skipped: number }
      if (created.length === 0) { alert('No hay variantes nuevas para agregar'); return }
      setRows(prev => prev.map(r =>
        r.id === parentId
          ? { ...r, children: [...(r.children ?? []), ...created] }
          : r
      ))
      setExpandedL1(s => new Set([...s, parentId]))
    } catch (e) {
      console.error('[NativeRenderer] expandVariants error:', e)
    }
  }, [boardSettings])

  // ── Import children from source ───────────────────────────────────────────

  const importChildren = useCallback(async (subItemId: string) => {
    try {
      const res = await fetch(`/api/sub-items/${subItemId}/import-children`, { method: 'POST' })
      const body = await res.json() as { created?: SubItemData[]; skipped?: number; error?: string; message?: string }
      if (!res.ok) { alert(body.error ?? 'Error al importar'); return }
      if (!body.created?.length) { alert(body.message ?? 'No hay sub-items nuevos del catálogo'); return }
      setRows(prev => prev.map(r =>
        r.id === subItemId ? { ...r, children: [...(r.children ?? []), ...body.created!] } : r
      ))
      setExpandedL1(s => new Set([...s, subItemId]))
    } catch (e) {
      console.error('[NativeRenderer] importChildren error:', e)
    }
  }, [])

  // ── Refresh row values from source ────────────────────────────────────────

  const refreshRow = useCallback(async (subItemId: string) => {
    try {
      const res  = await fetch(`/api/sub-items/${subItemId}/refresh`, { method: 'POST' })
      const body = await res.json() as { updated?: number; error?: string; locked?: boolean }
      if (!res.ok) { alert(body.locked ? 'Terminado — no se puede refrescar' : (body.error ?? 'Error al refrescar')); return }
      load()
    } catch (e) {
      console.error('[NativeRenderer] refreshRow error:', e)
    }
  }, [load])

  // ── Compute formula ────────────────────────────────────────────────────────

  const computeFormula = useCallback((col: SubItemColumn, row: SubItemData): number | null => {
    if (col.kind !== 'formula') return null
    const s = col.settings as {
      formula: string
      col_a: string
      col_b: string
      child_column?: string
    }

    // sum_children: sum a column across all L2 children
    if (s.formula === 'sum_children' && s.child_column) {
      const children = row.children ?? []
      return children.reduce<number>((acc, child) => {
        const val = child.values.find(v => v.col_key === s.child_column)
        return acc + (val?.value_number ?? 0)
      }, 0)
    }

    const vals: Record<string, number | null> = {}
    for (const v of row.values) vals[v.col_key] = v.value_number
    const a = vals[s.col_a], b = vals[s.col_b]
    if (a == null || b == null) return null
    switch (s.formula) {
      case 'multiply': return a * b
      case 'add':      return a + b
      case 'subtract': return a - b
      case 'percent':  return (a * b) / 100
      default:         return null
    }
  }, [])

  if (loading) return <LoadingState />

  const displayCols = columns.filter(c => c.kind !== 'formula')
  const formulaCols = columns.filter(c => c.kind === 'formula')

  // subitem_view filter
  const showL2 = subitemView !== 'L1_only'
  const hideL1 = subitemView === 'L2_only'

  // locked check helpers
  const statusColKey  = boardSettings?.status_sub_col_key as string | undefined
  const closedVals    = boardSettings?.closed_sub_values  as string[] | undefined
  const statusCol     = statusColKey ? columns.find(c => c.col_key === statusColKey) : undefined
  const isLocked = (row: SubItemData) => {
    if (!statusCol || !closedVals?.length) return false
    const v = row.values.find(v => v.column_id === statusCol.id)
    return closedVals.includes(v?.value_text ?? '')
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Column header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide select-none flex-none">
        <div className="w-5 flex-none" />
        <div className="w-16 flex-none">#</div>
        <div className="w-40 flex-none">Nombre</div>
        {displayCols.map(c => <div key={c.id} className="w-24 flex-none text-right">{c.name}</div>)}
        {formulaCols.map(c => <div key={c.id} className="w-24 flex-none text-right text-indigo-500">{c.name}</div>)}
        {/* + add column */}
        {addingCol ? (
          <AddColumnInline
            boardId={boardId}
            position={columns.length}
            onCreated={col => { setColumns(prev => [...prev, col]); setAddingCol(false) }}
            onCancel={() => setAddingCol(false)}
          />
        ) : (
          <button
            onClick={() => setAddingCol(true)}
            title="Agregar columna"
            className="w-7 flex-none flex items-center justify-center text-gray-300 hover:text-indigo-500 transition-colors normal-case font-normal tracking-normal"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <div className="w-7 flex-none" />
      </div>

      {/* ── Rows ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="flex items-center justify-center py-10 text-[13px] text-gray-400 italic">
            Sin sub-items
          </div>
        )}
        {rows.map(row => (
          <Fragment key={row.id}>
            {!hideL1 && (
              <NativeRow
                row={row} depth={0} isExpanded={expandedL1.has(row.id)}
                displayCols={displayCols} formulaCols={formulaCols}
                editTarget={editTarget}
                onToggleExpand={() => setExpandedL1(s => { const n = new Set(s); n.has(row.id) ? n.delete(row.id) : n.add(row.id); return n })}
                onStartEdit={f => setEditTarget({ id: row.id, field: f })}
                onCommit={(f, v) => editField(row.id, f, v)}
                onCancel={() => setEditTarget(null)}
                onDelete={() => remove(row.id, 0, null)}
                onAddChild={() => { setExpandedL1(s => new Set([...s, row.id])); setAddingL2For(row.id) }}
                computeFormula={computeFormula}
                onExpandVariants={boardSettings?.variant_dimensions ? () => expandVariants(row.id) : undefined}
                onOpenDetail={() => setOpenDetailId(row.id)}
                isLocked={isLocked(row)}
                onImportChildren={() => importChildren(row.id)}
                onRefresh={() => refreshRow(row.id)}
              />
            )}
            {showL2 && expandedL1.has(row.id) && (
              <>
                {(row.children ?? []).map(child => (
                  <NativeRow
                    key={child.id}
                    row={child} depth={1} isExpanded={false}
                    displayCols={displayCols} formulaCols={formulaCols}
                    editTarget={editTarget}
                    onToggleExpand={() => {}}
                    onStartEdit={f => setEditTarget({ id: child.id, field: f })}
                    onCommit={(f, v) => editField(child.id, f, v)}
                    onCancel={() => setEditTarget(null)}
                    onDelete={() => remove(child.id, 1, row.id)}
                    onAddChild={() => {}}
                    computeFormula={computeFormula}
                    onOpenDetail={() => setOpenDetailId(child.id)}
                  />
                ))}
                {addingL2For === row.id && (
                  <InlineAddRow depth={1} onAdd={n => createL2(row.id, n)} onCancel={() => setAddingL2For(null)} />
                )}
              </>
            )}
          </Fragment>
        ))}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex-none border-t border-gray-100 px-4 py-2">
        {sourceBoardId ? (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 text-[13px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Agregar desde fuente
          </button>
        ) : (
          <InlineAddButton onAdd={name => createL1(name)} />
        )}
      </div>

      {showPicker && sourceBoardId && (
        <ProductPicker
          sourceBoardId={sourceBoardId}
          onSelect={({ name, id }) => { createL1(name, id); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {openDetailId && (() => {
        const detailRow = findInTree(rows, openDetailId)
        if (!detailRow) return null
        return (
          <SubItemDetailDrawer
            row={detailRow}
            columns={columns}
            computeFormula={computeFormula}
            onCommit={(f, v) => editField(detailRow.id, f, v)}
            onClose={() => setOpenDetailId(null)}
          />
        )
      })()}
    </div>
  )
}

// ─── BoardItemsRenderer ───────────────────────────────────────────────────────
// Reference mode: shows live items from another board that point to current item.
// Read-only. config: { source_board_id, relation_col_id }

function BoardItemsRenderer({ itemId, viewId, viewName, compact }: { itemId: string; viewId: string; viewName: string; compact?: boolean }) {
  const [data,    setData]    = useState<BoardItemsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sub-item-views/${viewId}/data?itemId=${itemId}`)
      .then(r => r.json())
      .then(d => setData(d as BoardItemsData))
      .catch(e => console.error('[BoardItemsRenderer] error:', e))
      .finally(() => setLoading(false))
  }, [viewId, itemId])

  if (loading) return <LoadingState />

  const columns     = (data?.columns ?? []).filter(c => !c.is_hidden && c.kind !== 'relation' && c.kind !== 'formula')
  const items       = data?.items ?? []
  const boardName   = data?.source_board_name ?? viewName

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-none">
        <div className="flex-1 flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide select-none">
          <div className="w-16 flex-none">#</div>
          <div className="w-40 flex-none">Nombre</div>
          {columns.slice(0, 5).map(c => <div key={c.id} className="w-24 flex-none text-right">{c.name}</div>)}
        </div>
        <span className="flex-none text-[10px] bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-full font-medium">
          {boardName} · ref
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[13px] text-gray-400 italic">
            Sin registros relacionados
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="w-16 flex-none text-[12px] text-gray-400 font-mono">{item.sid}</div>
              <div className="w-40 flex-none text-[13px] text-gray-800 font-medium truncate">{item.name || '—'}</div>
              {columns.slice(0, 5).map(col => {
                const val = item.item_values?.find(v => v.column_id === col.id)
                const display = val?.value_text ?? (val?.value_number != null ? String(val.value_number) : null)
                return (
                  <div key={col.id} className="w-24 flex-none text-[12px] text-gray-600 truncate text-right">
                    {display ?? '—'}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── BoardSubItemsRenderer ────────────────────────────────────────────────────
// Reference mode: shows sub_items of items from another board related to current item.
// Read-only. config: { source_board_id, relation_col_id }

function BoardSubItemsRenderer({ itemId, viewId, viewName, compact }: { itemId: string; viewId: string; viewName: string; compact?: boolean }) {
  const [data,    setData]    = useState<BoardSubData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sub-item-views/${viewId}/data?itemId=${itemId}`)
      .then(r => r.json())
      .then(d => setData(d as BoardSubData))
      .catch(e => console.error('[BoardSubItemsRenderer] error:', e))
      .finally(() => setLoading(false))
  }, [viewId, itemId])

  if (loading) return <LoadingState />

  const columns = (data?.columns ?? []).filter(c => c.kind !== 'formula')
  const items   = data?.items ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-none">
        <div className="flex-1 flex items-center gap-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide select-none">
          <div className="w-16 flex-none">#</div>
          <div className="w-40 flex-none">Nombre</div>
          {columns.slice(0, 4).map(c => <div key={c.id} className="w-24 flex-none text-right">{c.name}</div>)}
        </div>
        <span className="flex-none text-[10px] bg-purple-50 text-purple-500 border border-purple-100 px-1.5 py-0.5 rounded-full font-medium">
          {viewName} · ref
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[13px] text-gray-400 italic">
            Sin sub-items relacionados
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="w-16 flex-none text-[12px] text-gray-400 font-mono">{item.sid}</div>
              <div className="w-40 flex-none text-[13px] text-gray-800 truncate">{item.name || '—'}</div>
              {columns.slice(0, 4).map(col => {
                const val = item.values.find(v => v.column_id === col.id)
                const display = val?.value_text ?? (val?.value_number != null ? String(val.value_number) : null)
                return (
                  <div key={col.id} className="w-24 flex-none text-[12px] text-gray-600 truncate text-right">
                    {display ?? '—'}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── NativeRow ────────────────────────────────────────────────────────────────

function NativeRow({
  row, depth, isExpanded, displayCols, formulaCols, editTarget,
  onToggleExpand, onStartEdit, onCommit, onCancel, onDelete, onAddChild,
  computeFormula, onExpandVariants, onOpenDetail, isLocked, onImportChildren, onRefresh,
}: {
  row: SubItemData; depth: number; isExpanded: boolean
  displayCols: SubItemColumn[]; formulaCols: SubItemColumn[]
  editTarget: EditTarget
  onToggleExpand: () => void
  onStartEdit: (f: string) => void
  onCommit: (f: string, v: unknown) => void
  onCancel: () => void
  onDelete: () => void
  onAddChild: () => void
  computeFormula: (col: SubItemColumn, row: SubItemData) => number | null
  onExpandVariants?: () => void
  onOpenDetail: () => void
  isLocked?: boolean
  onImportChildren?: () => void
  onRefresh?: () => void
}) {
  const isEditing = (f: string) => editTarget?.id === row.id && editTarget.field === f
  const indent    = depth === 1 ? 'pl-5' : ''

  return (
    <div className={`flex items-center gap-2 px-4 py-1 hover:bg-gray-50 group border-b border-gray-50 ${indent}`}>
      {/* Chevron */}
      <div className="w-5 flex-none flex items-center justify-center">
        {depth === 0 ? (
          <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d={isExpanded ? 'M2 4l4 4 4-4' : 'M4 2l4 4-4 4'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="text-gray-300 text-[10px]">└</span>
        )}
      </div>

      {/* SID */}
      <div className="w-16 flex-none text-[12px] text-gray-400 font-mono">{row.sid}</div>

      {/* Name */}
      <div className="w-40 flex-none">
        <EditableCell
          value={row.name} isEditing={isEditing('name')} kind="text"
          onStartEdit={() => onStartEdit('name')}
          onCommit={v => onCommit('name', v)} onCancel={onCancel}
        />
      </div>

      {/* Value columns */}
      {displayCols.map(col => {
        const val = row.values.find(v => v.column_id === col.id)
        if (col.kind === 'select') {
          const opts = (col.settings.options as { value: string; color: string }[] | undefined) ?? []
          const cur  = val?.value_text ?? ''
          const opt  = opts.find(o => o.value === cur)
          return (
            <div key={col.id} className="w-24 flex-none flex justify-end items-center">
              {isEditing(col.id) ? (
                <select
                  autoFocus
                  defaultValue={cur}
                  className="w-full text-[12px] border border-indigo-400 rounded px-1 py-0.5 outline-none bg-white"
                  onChange={e  => onCommit(col.id, e.target.value)}
                  onBlur={e    => { onCommit(col.id, e.target.value) }}
                  onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
                >
                  <option value="">—</option>
                  {opts.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                </select>
              ) : (
                <div onClick={() => onStartEdit(col.id)} className="cursor-pointer">
                  {opt
                    ? <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: opt.color }}>{opt.value}</span>
                    : <span className="text-[12px] text-gray-300">—</span>}
                </div>
              )}
            </div>
          )
        }
        return (
          <div key={col.id} className="w-24 flex-none text-right">
            <EditableCell
              value={col.kind === 'number' ? (val?.value_number ?? '') : (val?.value_text ?? '')}
              isEditing={isEditing(col.id)} kind={col.kind === 'number' ? 'number' : 'text'}
              onStartEdit={() => onStartEdit(col.id)}
              onCommit={v => onCommit(col.id, v)} onCancel={onCancel} align="right"
            />
          </div>
        )
      })}

      {/* Formula columns (read-only) */}
      {formulaCols.map(col => {
        const result = computeFormula(col, row)
        return (
          <div key={col.id} className="w-24 flex-none text-right text-[13px] text-indigo-700 font-medium">
            {result != null ? result.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
          </div>
        )
      })}

      {/* Actions */}
      <div className="w-7 flex-none flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Open detail */}
        <button onClick={onOpenDetail} title="Abrir detalle" className="text-gray-400 hover:text-indigo-600 transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
            <path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {depth === 0 && row.source_item_id && onImportChildren && (
          <button onClick={onImportChildren} title="Jalar sub-items del catálogo" className="text-gray-400 hover:text-blue-500 transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M6 2v7M3 6l3 3 3-3M2 10h8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {depth === 0 && row.source_item_id && onRefresh && (
          <button
            onClick={isLocked ? undefined : onRefresh}
            title={isLocked ? 'Terminado — no se puede refrescar' : 'Refrescar valores del catálogo'}
            disabled={isLocked}
            className={`transition-colors ${isLocked ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-green-600'}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M10 6A4 4 0 1 1 7 2.1M10 2v3H7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {depth === 0 && (
          <button onClick={onAddChild} title="Agregar L2" className="text-gray-400 hover:text-indigo-600 transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {depth === 0 && onExpandVariants && (
          <button onClick={onExpandVariants} title="Explotar variantes" className="text-gray-400 hover:text-yellow-500 transition-colors text-[10px]">⚡</button>
        )}
        <button onClick={onDelete} title="Eliminar" className="text-gray-400 hover:text-red-500 transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
            <path d="M2 2l8 8M10 2l-8 8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({
  value, isEditing, kind, onStartEdit, onCommit, onCancel, align = 'left',
}: {
  value: string | number; isEditing: boolean; kind: 'text' | 'number'
  onStartEdit: () => void; onCommit: (v: string | number) => void; onCancel: () => void
  align?: 'left' | 'right'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (isEditing) inputRef.current?.select() }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef} autoFocus defaultValue={String(value)}
        type={kind === 'number' ? 'number' : 'text'}
        className={`w-full text-[13px] bg-white border border-indigo-400 rounded px-1 py-0.5 outline-none ${align === 'right' ? 'text-right' : ''}`}
        onBlur={e => onCommit(kind === 'number' ? Number(e.target.value) : e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  onCommit(kind === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)
          if (e.key === 'Escape') onCancel()
        }}
      />
    )
  }

  const display  = value === '' || (value === 0 && kind === 'text') ? '' : value
  const isEmpty  = display === ''
  return (
    <div
      onClick={onStartEdit}
      className={`text-[13px] px-1 py-0.5 rounded cursor-text hover:bg-gray-100 transition-colors truncate ${align === 'right' ? 'text-right' : ''} ${isEmpty ? 'text-gray-400' : 'text-gray-800'}`}
    >
      {isEmpty ? '—' : display}
    </div>
  )
}

// ─── findInTree ───────────────────────────────────────────────────────────────

function findInTree(rows: SubItemData[], id: string): SubItemData | null {
  for (const r of rows) {
    if (r.id === id) return r
    if (r.children) {
      const found = findInTree(r.children, id)
      if (found) return found
    }
  }
  return null
}

// ─── SubItemDetailDrawer ──────────────────────────────────────────────────────

function SubItemDetailDrawer({
  row, columns, computeFormula, onCommit, onClose,
}: {
  row:            SubItemData
  columns:        SubItemColumn[]
  computeFormula: (col: SubItemColumn, row: SubItemData) => number | null
  onCommit:       (field: string, value: unknown) => void
  onClose:        () => void
}) {
  const [localName, setLocalName] = useState(row.name)
  const [editingField, setEditingField] = useState<string | null>(null)

  // sync name when row changes (after remote commit)
  useEffect(() => { setLocalName(row.name) }, [row.name])

  const displayCols = columns.filter(c => !c.is_hidden && c.kind !== 'formula')
  const formulaCols = columns.filter(c => !c.is_hidden && c.kind === 'formula')

  const getVal = (col: SubItemColumn) => {
    const v = row.values.find(v => v.column_id === col.id)
    return col.kind === 'number' ? (v?.value_number ?? '') : (v?.value_text ?? '')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-72 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-[11px] font-mono text-gray-400">#{row.sid}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
              <path d="M2 2l10 10M12 2L2 12" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Nombre</label>
            <input
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              onBlur={() => { if (localName !== row.name) onCommit('name', localName) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
              className="mt-1 w-full text-[13px] text-gray-800 font-medium border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400 transition-colors"
            />
          </div>

          {/* Value columns */}
          {displayCols.map(col => {
            const raw  = getVal(col)
            const opts = col.kind === 'select'
              ? (col.settings.options as { value: string; color: string }[] | undefined) ?? []
              : undefined
            const fieldKind: 'text' | 'number' | 'select' =
              col.kind === 'number' ? 'number' : col.kind === 'select' ? 'select' : 'text'
            return (
              <div key={col.id}>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{col.name}</label>
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
            )
          })}

          {/* Formula columns */}
          {formulaCols.map(col => {
            const result = computeFormula(col, row)
            return (
              <div key={col.id}>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{col.name}</label>
                <div className="mt-1 text-[13px] text-indigo-700 font-semibold px-2 py-1.5 bg-indigo-50 rounded">
                  {result != null
                    ? result.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function DrawerEditField({
  value, kind, editing, onStart, onCommit, onCancel, options,
}: {
  value:    string | number
  kind:     'text' | 'number' | 'select'
  editing:  boolean
  onStart:  () => void
  onCommit: (v: string | number) => void
  onCancel: () => void
  options?: { value: string; color: string }[]
}) {
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

  // Display: select shows colored badge
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

// ─── InlineAddRow ─────────────────────────────────────────────────────────────

function InlineAddRow({ depth, onAdd, onCancel }: { depth: number; onAdd: (n: string) => void; onCancel: () => void }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-1 border-b border-gray-50 ${depth === 1 ? 'pl-10' : 'pl-7'}`}>
      <input
        autoFocus placeholder="Nombre..."
        className="flex-1 text-[13px] border border-indigo-400 rounded px-2 py-0.5 outline-none"
        onKeyDown={e => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) onAdd(e.currentTarget.value.trim())
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={e => { if (e.currentTarget.value.trim()) onAdd(e.currentTarget.value.trim()); else onCancel() }}
      />
    </div>
  )
}

// ─── InlineAddButton ──────────────────────────────────────────────────────────

function InlineAddButton({ onAdd }: { onAdd: (n: string) => void }) {
  const [adding, setAdding] = useState(false)
  if (!adding) return (
    <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-[13px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
      <span className="text-lg leading-none">+</span> Agregar sub-item
    </button>
  )
  return <InlineAddRow depth={0} onAdd={n => { onAdd(n); setAdding(false) }} onCancel={() => setAdding(false)} />
}

// ─── AddColumnInline ──────────────────────────────────────────────────────────

function AddColumnInline({
  boardId, position, onCreated, onCancel,
}: {
  boardId:   string
  position:  number
  onCreated: (col: SubItemColumn) => void
  onCancel:  () => void
}) {
  const [name,    setName]    = useState('')
  const [kind,    setKind]    = useState('text')
  const [saving,  setSaving]  = useState(false)

  const save = async () => {
    if (!name.trim()) { onCancel(); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/sub-item-columns`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          col_key:  `col_${Date.now()}`,
          name:     name.trim(),
          kind,
          position,
        }),
      })
      if (!res.ok) { console.error('[AddColumnInline] failed:', res.status); onCancel(); return }
      const col = (await res.json()) as SubItemColumn
      onCreated(col)
    } catch (e) {
      console.error('[AddColumnInline] error:', e)
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1 flex-none normal-case font-normal tracking-normal">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nombre..."
        disabled={saving}
        className="w-28 text-[12px] border border-indigo-400 rounded px-1.5 py-0.5 outline-none bg-white"
        onKeyDown={e => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <select
        value={kind}
        onChange={e => setKind(e.target.value)}
        disabled={saving}
        className="text-[11px] border border-gray-200 rounded px-1 py-0.5 outline-none bg-white text-gray-700"
      >
        <option value="text">Texto</option>
        <option value="number">Número</option>
        <option value="date">Fecha</option>
        <option value="select">Select</option>
        <option value="boolean">Check</option>
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="text-indigo-600 hover:text-indigo-800 transition-colors text-[13px] leading-none px-0.5"
      >
        ✓
      </button>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600 transition-colors text-[14px] leading-none px-0.5"
      >
        ×
      </button>
    </div>
  )
}

// ─── LoadingState ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12 text-[13px] text-gray-400">Cargando...</div>
  )
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function patchTree(rows: SubItemData[], id: string, patch: Partial<SubItemData>): SubItemData[] {
  return rows.map(r => {
    if (r.id === id) return { ...r, ...patch }
    if (r.children) return { ...r, children: patchTree(r.children, id, patch) }
    return r
  })
}
