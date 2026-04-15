'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { ProductPicker } from './ProductPicker'
import { computeRollup, type RollupConfig } from '../lib/rollup-engine'
import { evaluateCondition, type FormulaCondition } from '../lib/formula-engine'
import { ColumnSettingsPanel, type PanelUser } from './ColumnSettingsPanel'
import { SelectCell } from './data-table/cells/SelectCell'

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
  permission_mode?: 'public' | 'inherit' | 'custom'
  user_access?: 'edit' | 'view' | null
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
  source_item_sid:  number | null
  source_board_sid: number | null
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
  itemId:                  string
  boardId:                 string
  views:                   SubItemView[]
  users?:                  PanelUser[]
  onCountChange?:          (count: number) => void
  onAddView?:              () => void
  onDeleteView?:           (viewId: string) => void
  onConfigureColumns?:     (viewId: string) => void
  onBoardColumnCreated?:   () => void
  compact?:                boolean
  columnsVersion?:         number
  boardSettings?:          Record<string, unknown>
  subitemView?:            'L1_only' | 'L1_L2' | 'L2_only'
  isBoardAdmin?:           boolean
}

export function SubItemsView({ itemId, boardId, views, users, onCountChange, onAddView, onDeleteView, onConfigureColumns, onBoardColumnCreated, compact, columnsVersion, boardSettings, subitemView, isBoardAdmin }: Props) {
  const [activeViewId, setActiveViewId] = useState<string>(views[0]?.id ?? '')
  const activeView = views.find(v => v.id === activeViewId) ?? views[0]

  if (!activeView) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[13px] text-gray-400">
        <span className="italic">Sin vistas configuradas</span>
        {onAddView && isBoardAdmin && (
          <button
            onClick={onAddView}
            className="px-3 py-1.5 text-[12px] font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Agregar vista
          </button>
        )}
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
              {/* ⚙ config button — only on active native tab, board admin only */}
              {isActive && v.type === 'native' && onConfigureColumns && isBoardAdmin && (
                <button
                  onClick={() => onConfigureColumns(v.id)}
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
              {/* × delete — any view can be removed, including the last one, board admin only */}
              {onDeleteView && isBoardAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteView(v.id) }}
                  title="Eliminar vista"
                  className="opacity-0 group-hover/tab:opacity-100 transition-opacity text-gray-300 hover:text-red-500 ml-0.5 p-0.5 rounded text-[13px] leading-none"
                >
                  ×
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
          users={users}
          onCountChange={onCountChange}
          onBoardColumnCreated={onBoardColumnCreated}
          compact={compact}
          boardSettings={boardSettings}
          subitemView={subitemView}
          isBoardAdmin={isBoardAdmin}
        />
      )}
      {activeView.type === 'board_items' && (
        <BoardItemsRenderer key={activeView.id} itemId={itemId} viewId={activeView.id} viewName={activeView.name} compact={compact} />
      )}
      {activeView.type === 'board_sub_items' && (
        <BoardSubItemsRenderer key={activeView.id} itemId={itemId} viewId={activeView.id} viewName={activeView.name} compact={compact} isBoardAdmin={isBoardAdmin} />
      )}
    </div>
  )
}

// ─── NativeRenderer ───────────────────────────────────────────────────────────
// Snapshot mode: shows sub_items belonging to this item.
// config.source_board_id → ProductPicker (snapshot from another board).
// Without source_board_id → manual add form.

function NativeRenderer({
  itemId, boardId, viewId, config, users, onCountChange, onBoardColumnCreated, compact, boardSettings, subitemView, isBoardAdmin,
}: {
  itemId:                  string
  boardId:                 string
  viewId:                  string
  config:                  Record<string, unknown>
  users?:                  PanelUser[]
  onCountChange?:          (count: number) => void
  onBoardColumnCreated?:   () => void
  compact?:                boolean
  boardSettings?:          Record<string, unknown>
  subitemView?:            'L1_only' | 'L1_L2' | 'L2_only'
  isBoardAdmin?:           boolean
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
  const [colSettings,  setColSettings]  = useState<SubItemColumn | null>(null)
  const [rollupTarget, setRollupTarget] = useState<{ colId: string; colKey: string; colName: string; colKind?: string; closedValues?: string[]; currentAggregate?: string; currentBoardColId?: string } | null>(null)
  const [savingRollup, setSavingRollup] = useState(false)

  // Column widths — resizable
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    __expand: 20,
    __sid:    64,
    __name:   160,
  })

  function cw(key: string, def = 96): number {
    return colWidths[key] ?? def
  }

  // Aggregates for footer
  type AggFn = 'sum' | 'avg' | 'min' | 'max' | 'count'
  const AGG_CYCLE: (AggFn | null)[] = [null, 'sum', 'avg', 'min', 'max', 'count']
  const AGG_LABEL: Record<AggFn, string> = { sum: 'Σ', avg: 'x̄', min: '↓', max: '↑', count: '#' }
  const [colAggregates, setColAggregates] = useState<Record<string, AggFn | null>>({})

  const startResize = useCallback((key: string, initW: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX
    const w0 = colWidths[key] ?? initW
    const move = (ev: MouseEvent) =>
      setColWidths(p => ({ ...p, [key]: Math.max(40, w0 + ev.clientX - x0) }))
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [colWidths])

  const onCountChangeRef = useRef(onCountChange)
  useEffect(() => { onCountChangeRef.current = onCountChange })
  useEffect(() => { onCountChangeRef.current?.(rows.length) }, [rows.length])

  // Aggregate helpers
  function computeFooterAgg(colId: string, colKind: string, fn: AggFn, getFormula?: (col: SubItemData) => number | null): number | null {
    const nums: number[] = []
    for (const row of rows) {
      let v: number | null = null
      if (colKind === 'formula' && getFormula) {
        v = getFormula(row)
      } else {
        v = row.values.find(val => val.column_id === colId)?.value_number ?? null
      }
      if (v !== null) nums.push(v)
    }
    if (nums.length === 0) return null
    switch (fn) {
      case 'sum':   return nums.reduce((a, b) => a + b, 0)
      case 'avg':   return nums.reduce((a, b) => a + b, 0) / nums.length
      case 'min':   return Math.min(...nums)
      case 'max':   return Math.max(...nums)
      case 'count': return nums.length
    }
  }

  function cycleAgg(colId: string) {
    setColAggregates(prev => {
      const cur = prev[colId] ?? null
      const idx = AGG_CYCLE.indexOf(cur)
      const next = AGG_CYCLE[(idx + 1) % AGG_CYCLE.length] ?? null
      return { ...prev, [colId]: next }
    })
  }

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
        body: JSON.stringify({ item_id: itemId, name: name.trim(), depth: 0, source_item_id: source_item_id ?? null, view_id: viewId }),
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
    setRows(prev =>
      field === 'name'
        ? patchTree(prev, id, { name: value as string })
        : patchValueInTree(prev, id, field, value)
    )
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

  // ── Rollup-up handlers ─────────────────────────────────────────────────────

  const saveRollupUp = useCallback(async (target: NonNullable<typeof rollupTarget>, aggregate: string) => {
    setSavingRollup(true)
    try {
      const prefix = aggregate === 'sum' ? 'Σ' : aggregate === 'avg' ? '⌀' : aggregate === 'max' ? '↑ Máx' : aggregate === 'percent_done' ? '%' : '↓ Mín'
      const colName = `${prefix} ${target.colName}`
      const rollup_config: Record<string, unknown> = { source_level: 'children', source_col_key: target.colKey, aggregate }
      // Store closed_values always for percent_done (even if empty — items route will use live options)
      if (aggregate === 'percent_done') {
        rollup_config.closed_values = target.closedValues ?? []
      }
      // 1. Create or update board_column kind='rollup'
      let boardColId: string
      if (target.currentBoardColId) {
        // PATCH existing column — prevents duplicate columns on aggregate change
        const patchRes = await fetch(`/api/boards/${boardId}/columns/${target.currentBoardColId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: colName, settings: { rollup_config } }),
        })
        if (!patchRes.ok) return
        boardColId = target.currentBoardColId
      } else {
        const colRes = await fetch(`/api/boards/${boardId}/columns`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: colName, kind: 'rollup', settings: { rollup_config } }),
        })
        if (!colRes.ok) return
        boardColId = ((await colRes.json()) as { id: string }).id
      }
      const newBoardCol = { id: boardColId }
      // 2. Save rollup_up in sub_item_column settings
      const col = columns.find(c => c.id === target.colId)
      await fetch(`/api/sub-item-columns/${target.colId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ settings: { ...(col?.settings ?? {}), rollup_up: { aggregate, board_col_id: newBoardCol.id } } }),
      })
      setColumns(prev => prev.map(c => c.id === target.colId
        ? { ...c, settings: { ...c.settings, rollup_up: { aggregate, board_col_id: newBoardCol.id } } }
        : c
      ))
      onBoardColumnCreated?.()
    } finally {
      setSavingRollup(false)
      setRollupTarget(null)
    }
  }, [boardId, columns, onBoardColumnCreated])

  const removeRollupUp = useCallback(async (target: NonNullable<typeof rollupTarget>) => {
    setSavingRollup(true)
    try {
      if (target.currentBoardColId) {
        await fetch(`/api/boards/${boardId}/columns/${target.currentBoardColId}`, { method: 'DELETE' })
      }
      const col = columns.find(c => c.id === target.colId)
      const newSettings = { ...(col?.settings ?? {}) } as Record<string, unknown>
      delete newSettings.rollup_up
      await fetch(`/api/sub-item-columns/${target.colId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ settings: newSettings }),
      })
      setColumns(prev => prev.map(c => c.id === target.colId ? { ...c, settings: newSettings } : c))
      onBoardColumnCreated?.()
    } finally {
      setSavingRollup(false)
      setRollupTarget(null)
    }
  }, [boardId, columns, onBoardColumnCreated])

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

    // Include rollup values so formulas can reference them (e.g. cantidad - sum_l2_cantidad)
    for (const rc of columns.filter(c => c.kind === 'rollup')) {
      const cfg = rc.settings.rollup_config as import('../lib/rollup-engine').RollupConfig | undefined
      if (cfg) vals[rc.col_key] = computeRollup(cfg, row)
    }

    const a = vals[s.col_a], b = vals[s.col_b]
    if (a == null || b == null) return null
    switch (s.formula) {
      case 'multiply': return a * b
      case 'add':      return a + b
      case 'subtract': return a - b
      case 'percent':  return (a * b) / 100
      default:         return null
    }
  }, [columns])

  if (loading) return <LoadingState />

  const displayCols = columns.filter(c => c.kind !== 'formula')
  const formulaCols = columns.filter(c => c.kind === 'formula')
  const rollupCols  = columns.filter(c => c.kind === 'rollup')

  // subitem_view filter
  const showL2 = subitemView !== 'L1_only'
  const hideL1 = subitemView === 'L2_only'

  // locked check — uses option.is_closed, rename-safe
  const statusColKey = boardSettings?.status_sub_col_key as string | undefined
  const statusCol    = statusColKey ? columns.find(c => c.col_key === statusColKey) : undefined
  const isLocked = (row: SubItemData) => {
    if (!statusCol) return false
    const v = row.values.find(v => v.column_id === statusCol.id)
    if (!v?.value_text) return false
    const opts = (statusCol.settings.options as { value: string; is_closed?: boolean }[] | undefined) ?? []
    return opts.find(o => o.value === v.value_text)?.is_closed === true
  }

  // ── Battery: stage breakdown + % done ─────────────────────────────────────
  // L2s roll up to L1 (all L2 done → L1 done). L1s roll up to item level.
  const battery = (() => {
    if (!statusCol || rows.length === 0) return null
    type Opt = { value: string; label: string; color?: string; is_closed?: boolean }
    const opts = (statusCol.settings.options as Opt[] | undefined) ?? []
    const firstClosedVal = opts.find(o => o.is_closed)?.value ?? null

    type Bucket = { value: string | null; label: string; color: string; count: number }
    const map = new Map<string | null, Bucket>()
    for (const o of opts) map.set(o.value, { value: o.value, label: o.label, color: o.color ?? '#94a3b8', count: 0 })
    map.set(null, { value: null, label: 'Sin estado', color: '#e5e7eb', count: 0 })

    let done = 0
    for (const l1 of rows) {
      let effVal: string | null
      let effDone: boolean
      if (l1.children && l1.children.length > 0) {
        const allDone = l1.children.every(l2 => isLocked(l2))
        if (allDone) {
          effVal = firstClosedVal; effDone = true
        } else {
          // use most common L2 status value
          const counts: Record<string, number> = {}
          for (const l2 of l1.children) {
            const v = l2.values.find(v => v.column_id === statusCol.id)
            const k = v?.value_text ?? '__null'
            counts[k] = (counts[k] ?? 0) + 1
          }
          const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '__null'
          effVal = top === '__null' ? null : top
          effDone = false
        }
      } else {
        const v = l1.values.find(v => v.column_id === statusCol.id)
        effVal = v?.value_text ?? null
        effDone = isLocked(l1)
      }
      if (effDone) done++
      ;(map.get(effVal) ?? map.get(null)!).count++
    }

    const total = rows.length
    const pct = Math.round((done / total) * 100)
    const segments = [...map.values()].filter(b => b.count > 0)
    return { segments, total, done, pct }
  })()

  return (
    <div className="flex flex-col h-full">
      {/* ── Battery ───────────────────────────────────────────────────── */}
      {battery && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 flex-none">
          <div className="flex flex-1 h-2 rounded-full overflow-hidden bg-gray-100">
            {battery.segments.map(seg => (
              <div
                key={seg.value ?? '__null'}
                style={{ width: `${(seg.count / battery.total) * 100}%`, backgroundColor: seg.color }}
                title={`${seg.label}: ${seg.count}`}
              />
            ))}
          </div>
          <span className="flex-none text-[12px] text-gray-500 whitespace-nowrap">
            {battery.done}/{battery.total} · {battery.pct}% completado
          </span>
        </div>
      )}
      {/* ── Column header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide select-none flex-none">
        <div className="flex-none" style={{ width: cw('__expand') }} />
        <div className="relative flex-none" style={{ width: cw('__sid') }}>
          #
          <div onMouseDown={e => startResize('__sid', 64, e)} className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none z-10 group/resizer" onClick={e => e.stopPropagation()}>
            <div className="h-4 w-px rounded-full bg-gray-200 group-hover/resizer:bg-indigo-400 transition-colors" />
          </div>
        </div>
        <div className="relative flex-none" style={{ width: cw('__name') }}>
          Nombre
          <div onMouseDown={e => startResize('__name', 160, e)} className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none z-10 group/resizer" onClick={e => e.stopPropagation()}>
            <div className="h-4 w-px rounded-full bg-gray-200 group-hover/resizer:bg-indigo-400 transition-colors" />
          </div>
        </div>
        {displayCols.map(c => {
          const hasRollup = !!(c.settings as Record<string, unknown>)?.rollup_up
          const rollupEligible = c.kind === 'number' || c.kind === 'select'
          return (
            <div key={c.id} className="relative flex-none group/col" style={{ width: cw(c.id) }}>
              <div className="flex items-center gap-1 overflow-hidden pr-3">
                <span className="flex-1 truncate min-w-0">{c.name}</span>
                {rollupEligible && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const ru = (c.settings as Record<string, unknown>)?.rollup_up as { aggregate?: string; board_col_id?: string } | undefined
                      const opts = (c.settings as Record<string, unknown>)?.options as { value: string; is_closed?: boolean }[] | undefined
                      setRollupTarget({ colId: c.id, colKey: c.col_key, colName: c.name, colKind: c.kind, closedValues: opts?.filter(o => o.is_closed).map(o => o.value), currentAggregate: ru?.aggregate, currentBoardColId: ru?.board_col_id })
                    }}
                    title={hasRollup ? 'Resumen activo — click para editar' : 'Agregar resumen al item'}
                    className={`shrink-0 text-[11px] leading-none transition-opacity px-0.5 font-bold ${hasRollup ? 'text-teal-500' : 'opacity-0 group-hover/col:opacity-100 text-gray-400 hover:text-teal-500'}`}
                  >↑</button>
                )}
                {isBoardAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); setColSettings(c) }}
                    title="Configurar columna"
                    className="opacity-0 group-hover/col:opacity-100 shrink-0 text-[14px] leading-none text-gray-400 hover:text-indigo-500 transition-opacity px-0.5"
                  >⋯</button>
                )}
              </div>
              <div onMouseDown={e => startResize(c.id, 96, e)} className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none z-10 group/resizer" onClick={e => e.stopPropagation()}>
                <div className="h-4 w-px rounded-full bg-gray-200 group-hover/resizer:bg-indigo-400 transition-colors" />
              </div>
            </div>
          )
        })}
        {formulaCols.map(c => {
          const hasRollup = !!(c.settings as Record<string, unknown>)?.rollup_up
          return (
            <div key={c.id} className="relative flex-none text-indigo-500 group/col" style={{ width: cw(c.id) }}>
              <div className="flex items-center gap-1 overflow-hidden pr-3">
                <span className="flex-1 truncate min-w-0">{c.name}</span>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    const ru = (c.settings as Record<string, unknown>)?.rollup_up as { aggregate?: string; board_col_id?: string } | undefined
                    setRollupTarget({ colId: c.id, colKey: c.col_key, colName: c.name, colKind: c.kind, currentAggregate: ru?.aggregate, currentBoardColId: ru?.board_col_id })
                  }}
                  title={hasRollup ? 'Resumen activo — click para editar' : 'Agregar resumen al item'}
                  className={`shrink-0 text-[11px] leading-none transition-opacity px-0.5 font-bold ${hasRollup ? 'text-teal-500' : 'opacity-0 group-hover/col:opacity-100 text-gray-400 hover:text-teal-500'}`}
                >↑</button>
                {isBoardAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); setColSettings(c) }}
                    title="Configurar columna"
                    className="opacity-0 group-hover/col:opacity-100 shrink-0 text-[14px] leading-none text-gray-400 hover:text-indigo-500 transition-opacity px-0.5"
                  >⋯</button>
                )}
              </div>
              <div onMouseDown={e => startResize(c.id, 96, e)} className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none z-10 group/resizer" onClick={e => e.stopPropagation()}>
                <div className="h-4 w-px rounded-full bg-gray-200 group-hover/resizer:bg-indigo-400 transition-colors" />
              </div>
            </div>
          )
        })}
        {rollupCols.map(col => (
          <div key={col.id} className="flex-none text-right" style={{ width: cw(col.id) }}>{col.name}</div>
        ))}
        {/* + add column */}
        {addingCol ? (
          <AddColumnInline
            boardId={boardId}
            viewId={viewId}
            sourceBoardId={sourceBoardId ?? undefined}
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
                displayCols={displayCols} formulaCols={formulaCols} rollupCols={rollupCols}
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
                colWidths={colWidths}
              />
            )}
            {showL2 && expandedL1.has(row.id) && (
              <>
                {(row.children ?? []).map(child => (
                  <NativeRow
                    key={child.id}
                    row={child} depth={1} isExpanded={false}
                    displayCols={displayCols} formulaCols={formulaCols} rollupCols={rollupCols}
                    editTarget={editTarget}
                    onToggleExpand={() => {}}
                    onStartEdit={f => setEditTarget({ id: child.id, field: f })}
                    onCommit={(f, v) => editField(child.id, f, v)}
                    onCancel={() => setEditTarget(null)}
                    onDelete={() => remove(child.id, 1, row.id)}
                    onAddChild={() => {}}
                    computeFormula={computeFormula}
                    onOpenDetail={() => setOpenDetailId(child.id)}
                    colWidths={colWidths}
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

      {/* ── Aggregate footer row ─────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1 border-t border-gray-100 bg-gray-50 flex-none text-[11px] select-none">
          <div className="flex-none" style={{ width: cw('__expand') }} />
          <div className="flex-none" style={{ width: cw('__sid') }} />
          <div className="flex-none text-gray-400 italic" style={{ width: cw('__name') }}>Totales</div>
          {displayCols.map(col => {
            if (col.kind !== 'number') return <div key={col.id} className="flex-none" style={{ width: cw(col.id) }} />
            const fn = colAggregates[col.id] ?? null
            const val = fn ? computeFooterAgg(col.id, col.kind, fn) : null
            return (
              <div
                key={col.id}
                className="flex-none text-right cursor-pointer group"
                style={{ width: cw(col.id) }}
                onClick={() => cycleAgg(col.id)}
                title={fn ? `${fn} — click para cambiar` : 'Click para agregar totales'}
              >
                {fn ? (
                  <span className="text-gray-600 font-medium">
                    <span className="text-gray-400 mr-1">{AGG_LABEL[fn]}</span>
                    {val != null ? val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                  </span>
                ) : (
                  <span className="text-gray-300 group-hover:text-gray-400 transition-colors">+</span>
                )}
              </div>
            )
          })}
          {formulaCols.map(col => {
            const fn = colAggregates[col.id] ?? null
            const val = fn ? computeFooterAgg(col.id, 'formula', fn, (row) => computeFormula(col, row)) : null
            return (
              <div
                key={col.id}
                className="flex-none text-right cursor-pointer group"
                style={{ width: cw(col.id) }}
                onClick={() => cycleAgg(col.id)}
                title={fn ? `${fn} — click para cambiar` : 'Click para agregar totales'}
              >
                {fn ? (
                  <span className="text-indigo-600 font-medium">
                    <span className="text-indigo-300 mr-1">{AGG_LABEL[fn]}</span>
                    {val != null ? val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                  </span>
                ) : (
                  <span className="text-gray-300 group-hover:text-gray-400 transition-colors">+</span>
                )}
              </div>
            )
          })}
          {rollupCols.map(col => {
            const fn = colAggregates[col.id] ?? null
            const val = fn ? computeFooterAgg(col.id, 'rollup', fn, (row) => {
              const cfg = col.settings.rollup_config as RollupConfig | undefined
              return cfg ? computeRollup(cfg, row) : null
            }) : null
            return (
              <div
                key={col.id}
                className="flex-none text-right cursor-pointer group"
                style={{ width: cw(col.id) }}
                onClick={() => cycleAgg(col.id)}
                title={fn ? `${fn} — click para cambiar` : 'Click para agregar totales'}
              >
                {fn ? (
                  <span className="text-teal-600 font-medium">
                    <span className="text-teal-300 mr-1">{AGG_LABEL[fn]}</span>
                    {val != null ? val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                  </span>
                ) : (
                  <span className="text-gray-300 group-hover:text-gray-400 transition-colors">+</span>
                )}
              </div>
            )
          })}
          <div className="w-7 flex-none" />
        </div>
      )}

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
            boardId={boardId}
            users={users}
            computeFormula={computeFormula}
            onCommit={(f, v) => editField(detailRow.id, f, v)}
            onColUpdated={updated => setColumns(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))}
            onColDeleted={colId => setColumns(prev => prev.filter(c => c.id !== colId))}
            onClose={() => setOpenDetailId(null)}
            isBoardAdmin={isBoardAdmin}
          />
        )
      })()}

      {colSettings && (
        <ColumnSettingsPanel
          column={{ ...colSettings, is_system: false }}
          boardId={boardId}
          allColumns={columns.map(c => ({ col_key: c.col_key, name: c.name, kind: c.kind, settings: (c.settings as Record<string, unknown>) ?? {} }))}
          users={users ?? []}
          patchEndpoint={`/api/sub-item-columns/${colSettings.id}`}
          permissionsEndpoint={colSettings ? `/api/sub-item-columns/${colSettings.id}/permissions` : undefined}
          onClose={() => setColSettings(null)}
          onPatched={updated => {
            setColumns(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
          }}
          onUpdated={updated => {
            setColumns(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
            setColSettings(null)
          }}
          onDeleted={colId => { setColumns(prev => prev.filter(c => c.id !== colId)); setColSettings(null) }}
        />
      )}
      {rollupTarget && (
        <RollupUpPopup
          target={rollupTarget}
          saving={savingRollup}
          onSelect={agg => saveRollupUp(rollupTarget, agg)}
          onRemove={rollupTarget.currentAggregate ? () => removeRollupUp(rollupTarget) : undefined}
          onClose={() => setRollupTarget(null)}
        />
      )}
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

function BoardSubItemsRenderer({ itemId, viewId, viewName, compact, isBoardAdmin }: { itemId: string; viewId: string; viewName: string; compact?: boolean; isBoardAdmin?: boolean }) {
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
  row, depth, isExpanded, displayCols, formulaCols, rollupCols, editTarget,
  onToggleExpand, onStartEdit, onCommit, onCancel, onDelete, onAddChild,
  computeFormula, onExpandVariants, onOpenDetail, isLocked, onImportChildren, onRefresh,
  colWidths,
}: {
  row: SubItemData; depth: number; isExpanded: boolean
  displayCols: SubItemColumn[]; formulaCols: SubItemColumn[]; rollupCols: SubItemColumn[]
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
  colWidths: Record<string, number>
}) {
  const isEditing = (f: string) => editTarget?.id === row.id && editTarget.field === f
  const indent    = depth === 1 ? 'pl-5' : ''

  function w(key: string, def = 96): number {
    return colWidths[key] ?? def
  }

  return (
    <div className={`flex items-center gap-2 px-4 py-1 hover:bg-gray-50 group border-b border-gray-50 ${indent}`}>
      {/* Chevron */}
      <div className="flex-none flex items-center justify-center" style={{ width: w('__expand', 20) }}>
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
      <div className="flex-none text-[12px] text-gray-400 font-mono" style={{ width: w('__sid', 64) }}>{row.sid}</div>

      {/* Name */}
      <div className="flex-none" style={{ width: w('__name', 160) }}>
        <EditableCell
          value={row.name} isEditing={isEditing('name')} kind="text"
          onStartEdit={() => onStartEdit('name')}
          onCommit={v => onCommit('name', v)} onCancel={onCancel}
        />
      </div>

      {/* Value columns */}
      {displayCols.map(col => {
        // Check user access level: 'edit' | 'view' | null
        const access = col.user_access

        if (access === null || access === undefined) {
          // No permission: render empty gray cell
          return (
            <div key={col.id} className="flex-none bg-gray-50 h-full w-full" style={{ width: w(col.id, 96) }} title="Sin permiso" />
          )
        }

        const val = row.values.find(v => v.column_id === col.id)
        const cellValue = col.kind === 'number' ? (val?.value_number ?? null) : (val?.value_text ?? null)

        // Validation check
        const colValidation = (col.settings as Record<string, unknown>)?.validation as { condition: { col?: string; operator: string; value?: unknown }; message: string } | undefined
        const isInvalid = (() => {
          if (!colValidation?.condition) return false
          const condCol = colValidation.condition.col || col.col_key
          const evalRow: Record<string, unknown> = {}
          for (const v of row.values) {
            evalRow[v.col_key ?? ''] = v.value_number ?? v.value_text ?? null
          }
          evalRow[col.col_key] = cellValue
          try {
            return !evaluateCondition({ ...colValidation.condition as FormulaCondition, col: condCol }, evalRow)
          } catch { return false }
        })()

        // Determine if user can edit this column
        const canEdit = access === 'edit'

        if (col.kind === 'select') {
          const opts = (col.settings.options as { value: string; label: string; color?: string }[] | undefined) ?? []
          return (
            <div key={col.id} className="relative flex-none" style={{ width: w(col.id, 96) }} onClick={e => e.stopPropagation()}>
              <SelectCell
                value={val?.value_text ?? null}
                isEditing={isEditing(col.id)}
                column={{ key: col.col_key, label: col.name, kind: 'select', settings: { options: opts } }}
                rowId={row.id}
                onStartEdit={canEdit ? () => onStartEdit(col.id) : () => {}}
                onCommit={v => onCommit(col.id, v as string)}
                onCancel={onCancel}
                onNavigate={() => {}}
              />
              {isInvalid && (
                <div className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-red-400/70 bg-red-50/30" title={colValidation?.message}>
                  <span className="absolute top-0.5 right-0.5 text-[10px] leading-none select-none">❌</span>
                </div>
              )}
            </div>
          )
        }
        return (
          <div key={col.id} className="relative flex-none text-right" style={{ width: w(col.id, 96) }}>
            <EditableCell
              value={col.kind === 'number' ? (val?.value_number ?? '') : (val?.value_text ?? '')}
              isEditing={isEditing(col.id)} kind={col.kind === 'number' ? 'number' : 'text'}
              onStartEdit={canEdit ? () => onStartEdit(col.id) : () => {}}
              onCommit={v => onCommit(col.id, v)} onCancel={onCancel} align="right"
            />
            {isInvalid && (
              <div className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-red-400/70 bg-red-50/30" title={colValidation?.message}>
                <span className="absolute top-0.5 right-0.5 text-[10px] leading-none select-none">❌</span>
              </div>
            )}
          </div>
        )
      })}

      {/* Formula columns (read-only) */}
      {formulaCols.map(col => {
        const result = computeFormula(col, row)
        const colValidation = (col.settings as Record<string, unknown>)?.validation as { condition: { col?: string; operator: string; value?: unknown }; message: string } | undefined
        const isInvalid = (() => {
          if (!colValidation?.condition) return false
          const condCol = colValidation.condition.col || col.col_key
          const evalRow: Record<string, unknown> = { [col.col_key]: result }
          for (const v of row.values) evalRow[v.col_key ?? ''] = v.value_number ?? v.value_text ?? null
          try { return !evaluateCondition({ ...colValidation.condition as FormulaCondition, col: condCol }, evalRow) } catch { return false }
        })()
        return (
          <div key={col.id} className="relative flex-none text-right text-[13px] text-indigo-700 font-medium" style={{ width: w(col.id, 96) }}>
            {result != null ? result.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
            {isInvalid && (
              <div className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-red-400/70 bg-red-50/30" title={colValidation?.message}>
                <span className="absolute top-0.5 right-0.5 text-[10px] leading-none select-none">❌</span>
              </div>
            )}
          </div>
        )
      })}

      {/* Rollup columns (read-only, solo L1 que tengan children) */}
      {rollupCols.map(col => {
        const cfg = col.settings.rollup_config as RollupConfig | undefined
        const result = cfg ? computeRollup(cfg, row) : null
        const colValidation = (col.settings as Record<string, unknown>)?.validation as { condition: { col?: string; operator: string; value?: unknown }; message: string } | undefined
        const isInvalid = (() => {
          if (!colValidation?.condition) return false
          const condCol = colValidation.condition.col || col.col_key
          const evalRow: Record<string, unknown> = { [col.col_key]: result }
          for (const v of row.values) evalRow[v.col_key ?? ''] = v.value_number ?? v.value_text ?? null
          try { return !evaluateCondition({ ...colValidation.condition as FormulaCondition, col: condCol }, evalRow) } catch { return false }
        })()
        return (
          <div key={col.id} className="relative flex-none text-right text-[13px] text-teal-700 font-medium" style={{ width: w(col.id, 96) }}>
            {result != null ? result.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
            {isInvalid && (
              <div className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-red-400/70 bg-red-50/30" title={colValidation?.message}>
                <span className="absolute top-0.5 right-0.5 text-[10px] leading-none select-none">❌</span>
              </div>
            )}
          </div>
        )
      })}

      {/* Actions */}
      <div className="w-7 flex-none flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Open detail / navigate to source */}
        {row.source_board_sid && row.source_item_sid ? (
          <a
            href={`/app/b/${row.source_board_sid}/${row.source_item_sid}`}
            title="Ver en catálogo"
            className="text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        ) : (
          <button onClick={onOpenDetail} title="Abrir detalle" className="text-gray-400 hover:text-indigo-600 transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
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

// ─── RollupUpPopup ────────────────────────────────────────────────────────────

const ROLLUP_OPTIONS_NUMBER = [
  { value: 'sum',   label: 'Σ  Suma'     },
  { value: 'avg',   label: '⌀  Promedio' },
  { value: 'max',   label: '↑  Máximo'   },
  { value: 'min',   label: '↓  Mínimo'   },
  { value: 'count', label: '#  Conteo'   },
]

const ROLLUP_OPTIONS_SELECT = [
  { value: 'percent_done', label: '%  Completado' },
  { value: 'count',        label: '#  Conteo'     },
]

function RollupUpPopup({
  target, saving, onSelect, onRemove, onClose,
}: {
  target:    { colName: string; colKind?: string; closedValues?: string[]; currentAggregate?: string }
  saving:    boolean
  onSelect:  (aggregate: string) => void
  onRemove?: () => void
  onClose:   () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none">
      <div
        ref={ref}
        className="pointer-events-auto mt-24 bg-white border border-gray-200 rounded-xl shadow-xl w-52 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-3 py-2.5 border-b border-gray-100">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Resumen → item</p>
          <p className="text-[12px] text-gray-700 truncate mt-0.5">"{target.colName}"</p>
        </div>
        <div className="py-1">
          {(target.colKind === 'select' ? ROLLUP_OPTIONS_SELECT : ROLLUP_OPTIONS_NUMBER).map(opt => (
            <button
              key={opt.value}
              onClick={() => !saving && onSelect(opt.value)}
              disabled={saving}
              className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between ${target.currentAggregate === opt.value ? 'text-teal-600 font-semibold' : 'text-gray-700'}`}
            >
              {opt.label}
              {target.currentAggregate === opt.value && <span className="text-teal-500 text-[10px]">activo</span>}
            </button>
          ))}
        </div>
        {onRemove && (
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={() => !saving && onRemove()}
              disabled={saving}
              className="w-full text-left px-3 py-1.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
            >
              Quitar resumen
            </button>
          </div>
        )}
        {saving && (
          <div className="px-3 py-2 text-[11px] text-gray-400 text-center border-t border-gray-100">Guardando…</div>
        )}
      </div>
    </div>
  )
}

// ─── SubItemDetailDrawer ──────────────────────────────────────────────────────

function SubItemDetailDrawer({
  row, columns, boardId, users, computeFormula, onCommit, onColUpdated, onColDeleted, onClose, isBoardAdmin,
}: {
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
}) {
  const [localName,    setLocalName]    = useState(row.name)
  const [editingName,  setEditingName]  = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [colSettings,  setColSettings]  = useState<SubItemColumn | null>(null)

  useEffect(() => { setLocalName(row.name) }, [row.name])

  // Find "estado" column (first select col with is_closed options) for badge
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
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">

        {/* Top bar: sid + close */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-none">
          <span className="text-[11px] font-mono text-gray-400">#{row.sid}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
              <path d="M2 2l10 10M12 2L2 12" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Name + estado badge — mirrors ItemDetailView header */}
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

        {/* Info panel — mirrors ItemDetailView info panel */}
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

      {/* Column settings panel */}
      {colSettings && (
        <ColumnSettingsPanel
          column={{ ...colSettings, is_system: false }}
          boardId={boardId}
          allColumns={columns.map(c => ({ col_key: c.col_key, name: c.name, kind: c.kind, settings: (c.settings as Record<string, unknown>) ?? {} }))}
          users={users ?? []}
          patchEndpoint={`/api/sub-item-columns/${colSettings.id}`}
          permissionsEndpoint={colSettings ? `/api/sub-item-columns/${colSettings.id}/permissions` : undefined}
          onClose={() => setColSettings(null)}
          onPatched={updated => { onColUpdated(updated as unknown as SubItemColumn) }}
          onUpdated={updated => { onColUpdated(updated as unknown as SubItemColumn); setColSettings(null) }}
          onDeleted={colId => { onColDeleted(colId); setColSettings(null) }}
        />
      )}
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

type SourceBoardCol = { id: string; col_key: string; name: string; kind: string }

const COL_KIND_OPTIONS = [
  { value: 'text',      label: 'Texto' },
  { value: 'number',    label: 'Número' },
  { value: 'date',      label: 'Fecha' },
  { value: 'select',    label: 'Select' },
  { value: 'boolean',   label: 'Check' },
  { value: 'formula',   label: 'Fórmula' },
  { value: 'relation',  label: 'Relación' },
  { value: 'signature', label: 'Firma' },
  { value: 'file',      label: 'Archivo' },
  { value: 'phone',     label: 'Teléfono' },
  { value: 'email',     label: 'Email' },
  { value: 'url',       label: 'URL' },
]

function AddColumnInline({
  boardId, viewId, sourceBoardId, position, onCreated, onCancel,
}: {
  boardId:        string
  viewId:         string
  sourceBoardId?: string
  position:       number
  onCreated:      (col: SubItemColumn) => void
  onCancel:       () => void
}) {
  const [name,           setName]          = useState('')
  const [kind,           setKind]          = useState('text')
  const [sourceColKey,   setSourceColKey]  = useState('')
  const [sourceCols,     setSourceCols]    = useState<SourceBoardCol[]>([])
  const [saving,         setSaving]        = useState(false)
  const [kindPanelPos,   setKindPanelPos]  = useState<{ top: number; left: number } | null>(null)
  const kindBtnRef  = useRef<HTMLButtonElement>(null)
  const kindPanelRef = useRef<HTMLDivElement>(null)

  const currentKindLabel = COL_KIND_OPTIONS.find(o => o.value === kind)?.label ?? kind

  // Fetch source board columns so user can link a source_col_key
  useEffect(() => {
    if (!sourceBoardId) return
    fetch(`/api/boards/${sourceBoardId}/columns`)
      .then(r => r.json())
      .then((data: SourceBoardCol[]) => setSourceCols(Array.isArray(data) ? data : []))
      .catch(() => setSourceCols([]))
  }, [sourceBoardId])

  // Close kind panel on outside click
  useEffect(() => {
    if (!kindPanelPos) return
    const onDown = (e: MouseEvent) => {
      if (
        kindPanelRef.current && !kindPanelRef.current.contains(e.target as Node) &&
        kindBtnRef.current   && !kindBtnRef.current.contains(e.target as Node)
      ) setKindPanelPos(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [kindPanelPos])

  const openKindPanel = () => {
    if (!kindBtnRef.current) return
    const r = kindBtnRef.current.getBoundingClientRect()
    const PANEL_W = 140
    const left = (r.left + PANEL_W > window.innerWidth - 8) ? Math.max(8, r.right - PANEL_W) : r.left
    setKindPanelPos({ top: r.bottom + 2, left })
  }

  const save = async () => {
    if (!name.trim()) { onCancel(); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/sub-item-columns`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          col_key:        `col_${Date.now()}`,
          name:           name.trim(),
          kind,
          position,
          source_col_key: sourceColKey || null,
          view_id:        viewId,
        }),
      })
      if (!res.ok) { console.error('[AddColumnInline] failed:', res.status, await res.text()); onCancel(); return }
      const col = (await res.json()) as SubItemColumn
      onCreated(col)
    } catch (e) {
      console.error('[AddColumnInline] error:', e)
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  // relative z-20 keeps this above the z-10 resize handles; stopPropagation prevents bubbling to row handlers
  return (
    <>
      <div
        className="relative z-20 flex items-center gap-1 flex-none normal-case font-normal tracking-normal select-auto"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
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
        {/* Kind picker button — opens portal list (avoids native select OS events) */}
        <button
          ref={kindBtnRef}
          type="button"
          disabled={saving}
          onClick={openKindPanel}
          className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-700 hover:border-indigo-400 whitespace-nowrap"
        >
          {currentKindLabel} ▾
        </button>
        {/* Source column picker — only for views linked to a source board */}
        {sourceBoardId && sourceCols.length > 0 && (
          <select
            value={sourceColKey}
            onChange={e => setSourceColKey(e.target.value)}
            disabled={saving}
            onMouseDown={e => e.stopPropagation()}
            title="Vincular a columna del board fuente (opcional)"
            className="text-[11px] border border-gray-200 rounded px-1 py-0.5 outline-none bg-white text-gray-500 max-w-[90px]"
          >
            <option value="">Sin vínculo</option>
            {sourceCols.map(c => (
              <option key={c.col_key} value={c.col_key}>{c.name}</option>
            ))}
          </select>
        )}
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

      {/* Kind picker portal */}
      {kindPanelPos && createPortal(
        <div
          ref={kindPanelRef}
          style={{ position: 'fixed', top: kindPanelPos.top, left: kindPanelPos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36"
          onMouseDown={e => e.stopPropagation()}
        >
          {COL_KIND_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { setKind(o.value); setKindPanelPos(null) }}
              className={`w-full text-left text-[12px] px-3 py-1 transition-colors ${
                kind === o.value
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >{o.label}</button>
          ))}
        </div>,
        document.body
      )}
    </>
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

function patchValueInTree(rows: SubItemData[], id: string, columnId: string, value: unknown): SubItemData[] {
  return rows.map(row => {
    if (row.id === id) {
      const isNum = typeof value === 'number'
      const existing = row.values.find(v => v.column_id === columnId)
      const newVal = existing
        ? { ...existing, value_number: isNum ? (value as number) : existing.value_number, value_text: !isNum ? (value as string) : existing.value_text }
        : { column_id: columnId, col_key: '', value_number: isNum ? (value as number) : null, value_text: !isNum ? (value as string) : null, value_date: null, value_json: null }
      const newValues = existing
        ? row.values.map(v => v.column_id === columnId ? newVal : v)
        : [...row.values, newVal]
      return { ...row, values: newValues }
    }
    if (row.children?.length) {
      return { ...row, children: patchValueInTree(row.children, id, columnId, value) }
    }
    return row
  })
}
