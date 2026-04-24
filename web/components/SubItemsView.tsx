'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import type { SubItemValue, SubItemData } from '@/lib/boards/types'
import type { SubItemView, SubItemColumn, NativeData, EditTarget } from './sub-items/types'
import { LoadingState } from './sub-items/LoadingState'
import { BoardItemsRenderer } from './sub-items/BoardItemsRenderer'
import { BoardSubItemsRenderer } from './sub-items/BoardSubItemsRenderer'
import { SubItemDetailDrawer } from './sub-items/SubItemDetailDrawer'
import { RollupUpPopup } from './sub-items/RollupUpPopup'
import { AddColumnInline } from './sub-items/AddColumnInline'
import { ProductPicker } from './ProductPicker'
import { computeRollup, type RollupConfig } from '../lib/rollup-engine'
import { evaluateCondition, type FormulaCondition } from '../lib/formula-engine'
import { ColumnSettingsPanel, type PanelUser } from './ColumnSettingsPanel'
import { SelectCell } from './data-table/cells/SelectCell'
import { ImageCell } from './data-table/cells/ImageCell'
import type { CellValue } from './data-table/types'
import { findInTree, patchTree, patchValueInTree } from '@/lib/sub-items/tree'

// ─── Shell ────────────────────────────────────────────────────────────────────

type Props = {
  workspaceSid?:           number
  itemId:                  string
  boardId:                 string
  boardSystemKey?:         string | null
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

export function SubItemsView({ workspaceSid, itemId, boardId, boardSystemKey, views, users, onCountChange, onAddView, onDeleteView, onConfigureColumns, onBoardColumnCreated, compact, columnsVersion, boardSettings, subitemView, isBoardAdmin }: Props) {
  const [activeViewId, setActiveViewId] = useState<string>(views[0]?.id ?? '')
  const activeView = views.find(v => v.id === activeViewId) ?? views[0]

  if (!activeView) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[13px] text-[var(--ink-3)]">
        <span className="italic">Sin vistas configuradas</span>
        {onAddView && isBoardAdmin && (
          <button
            onClick={onAddView}
            className="px-3 py-1.5 text-[12px] font-medium text-[var(--brand)] border border-[var(--brand-soft)] rounded hover:bg-[var(--brand-soft)] transition-colors flex items-center gap-1.5"
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
      <div className="flex items-center gap-0.5 border-b border-[var(--border)] px-3 pt-1.5 flex-none">
        {views.map(v => {
          const isActive = activeViewId === v.id
          return (
            <div key={v.id} className="flex items-center group/tab">
              <button
                onClick={() => setActiveViewId(v.id)}
                className={`px-3 py-2 text-[12.5px] border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'border-[var(--brand)] text-[var(--brand)]'
                    : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink-2)]'
                }`}
              >
                {v.name}
                {v.type !== 'native' && (
                  <em className="not-italic font-[family-name:var(--font-geist-mono)] text-[10.5px] px-1.5 py-0 bg-[var(--bg)] text-[var(--ink-4)] rounded-lg font-normal">ref</em>
                )}
              </button>
              {/* ⚙ config button — only on active native tab, board admin only */}
              {isActive && v.type === 'native' && onConfigureColumns && isBoardAdmin && (
                <button
                  onClick={() => onConfigureColumns(v.id)}
                  title="Configurar columnas"
                  className="text-[var(--ink-4)] hover:text-[var(--brand)] transition-colors p-0.5 rounded"
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
                  className="opacity-0 group-hover/tab:opacity-100 transition-opacity text-[var(--ink-4)] hover:text-[var(--stage-lost)] ml-0.5 p-0.5 rounded text-[13px] leading-none"
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
            className="ml-1 px-2 py-1.5 text-[12px] text-[var(--ink-4)] hover:text-[var(--brand)] transition-colors flex items-center gap-1"
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
          boardSystemKey={boardSystemKey}
          viewId={activeView.id}
          config={activeView.config}
          users={users}
          onCountChange={onCountChange}
          onBoardColumnCreated={onBoardColumnCreated}
          compact={compact}
          boardSettings={boardSettings}
          subitemView={subitemView}
          isBoardAdmin={isBoardAdmin}
          workspaceSid={workspaceSid}
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
  itemId, boardId, boardSystemKey, viewId, config, users, onCountChange, onBoardColumnCreated, compact, boardSettings, subitemView, isBoardAdmin, workspaceSid,
}: {
  itemId:                  string
  boardId:                 string
  boardSystemKey?:         string | null
  viewId:                  string
  config:                  Record<string, unknown>
  users?:                  PanelUser[]
  onCountChange?:          (count: number) => void
  onBoardColumnCreated?:   () => void
  compact?:                boolean
  boardSettings?:          Record<string, unknown>
  subitemView?:            'L1_only' | 'L1_L2' | 'L2_only'
  isBoardAdmin?:           boolean
  workspaceSid?:           number
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
  const [materializing, setMaterializing] = useState(false)
  const [materializeError, setMaterializeError] = useState<string | null>(null)
  const [conditionalOptions, setConditionalOptions] = useState<Record<string, Record<string, string[]>>>({})

  const router = useRouter()

  // Only opp boards with a source-mapped Catálogo view can materialize a quote
  const canMaterializeQuote = boardSystemKey === 'opportunities' && sourceBoardId !== null
  // Only catalog boards (Variantes view) can expand variants
  const canExpandVariants = boardSystemKey === 'catalog' && sourceBoardId === null

  const [expandModalOpen, setExpandModalOpen] = useState(false)
  const [expandUseTallas, setExpandUseTallas] = useState(true)
  const [expandUseColores, setExpandUseColores] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [expandError, setExpandError] = useState<string | null>(null)

  const materializeQuote = useCallback(async () => {
    setMaterializing(true)
    setMaterializeError(null)
    try {
      const res = await fetch(`/api/items/${itemId}/materialize-quote`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMaterializeError(data.error ?? res.statusText)
        return
      }
      const quoteSid: number | undefined = data.quote?.quote_sid
      const quotesBoardSid: number | undefined = data.quotes_board_sid ?? undefined
      if (workspaceSid && quoteSid && quotesBoardSid) {
        router.push(`/app/w/${workspaceSid}/b/${quotesBoardSid}/${quoteSid}`)
        return
      }
      // Fallback: notify so the reflejo tab refreshes in place
      window.dispatchEvent(new CustomEvent('quote-materialized'))
    } finally {
      setMaterializing(false)
    }
  }, [itemId, workspaceSid, router])

  // Column widths — resizable
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    __expand: 20,
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
      setConditionalOptions((data as NativeData).conditional_options ?? {})
    } catch (e) {
      console.error('[NativeRenderer] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [viewId, itemId])

  useEffect(() => { load() }, [load])

  const runExpand = useCallback(async () => {
    setExpanding(true)
    setExpandError(null)
    try {
      const res = await fetch(`/api/items/${itemId}/expand-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_tallas: expandUseTallas, use_colores: expandUseColores }),
      })
      const data = await res.json()
      if (!res.ok) {
        setExpandError(data.error ?? res.statusText)
        return
      }
      setExpandModalOpen(false)
      await load()
    } finally {
      setExpanding(false)
    }
  }, [itemId, expandUseTallas, expandUseColores, load])

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
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] flex-none">
          <div className="flex flex-1 h-2 rounded-full overflow-hidden bg-[var(--surface-2)]">
            {battery.segments.map(seg => (
              <div
                key={seg.value ?? '__null'}
                style={{ width: `${(seg.count / battery.total) * 100}%`, backgroundColor: seg.color }}
                title={`${seg.label}: ${seg.count}`}
              />
            ))}
          </div>
          <span className="flex-none text-[12px] text-[var(--ink-3)] whitespace-nowrap">
            {battery.done}/{battery.total} · {battery.pct}% completado
          </span>
        </div>
      )}

      {/* ── Card wrapper ─────────────────────────────────────────────── */}
      <div className={[
        'flex flex-col flex-1 min-h-0 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden',
        compact ? 'mx-3 my-2' : 'mx-4 my-3',
      ].join(' ')}>

        {/* Sub-header: "Partidas" label + count + acciones */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] flex-none">
          <span className="label-caps text-[var(--ink-3)]">Partidas</span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[10.5px] px-1.5 py-0 bg-[var(--bg)] text-[var(--ink-3)] rounded-lg font-normal">
            {rows.length}
          </span>
          <div className="flex-1" />
        </div>

      {/* ── Scrollable region: header + rows + footer scroll together ──── */}
      <div className="flex-1 min-h-0 overflow-auto">
      <div className="min-w-max">

      {/* ── Column header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--ink-4)] uppercase tracking-wide select-none flex-none sticky top-0 z-10">
        <div className="flex-none" style={{ width: cw('__expand') }} />
        <div className="relative flex-none" style={{ width: cw('__name') }}>
          Nombre
          <div onMouseDown={e => startResize('__name', 160, e)} className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none z-10 group/resizer" onClick={e => e.stopPropagation()}>
            <div className="h-4 w-px rounded-full bg-[var(--border)] group-hover/resizer:bg-[var(--brand-soft)] transition-colors" />
          </div>
        </div>
        {displayCols.map(c => {
          const hasRollup = !!(c.settings as Record<string, unknown>)?.rollup_up
          const rollupEligible = c.kind === 'number' || c.kind === 'select'
          const kindDefault = c.kind === 'image' || c.kind === 'file' ? 180 : 96
          return (
            <div key={c.id} className="relative flex-none group/col" style={{ width: cw(c.id, kindDefault) }}>
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
                    className={`shrink-0 text-[11px] leading-none transition-opacity px-0.5 font-bold ${hasRollup ? 'text-[var(--brand)]' : 'opacity-0 group-hover/col:opacity-100 text-[var(--ink-4)] hover:text-[var(--brand)]'}`}
                  >↑</button>
                )}
                {isBoardAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); setColSettings(c) }}
                    title="Configurar columna"
                    className="opacity-0 group-hover/col:opacity-100 shrink-0 text-[14px] leading-none text-[var(--ink-4)] hover:text-[var(--brand)] transition-opacity px-0.5"
                  >⋯</button>
                )}
              </div>
              <div onMouseDown={e => startResize(c.id, 96, e)} className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none z-10 group/resizer" onClick={e => e.stopPropagation()}>
                <div className="h-4 w-px rounded-full bg-[var(--border)] group-hover/resizer:bg-[var(--brand-soft)] transition-colors" />
              </div>
            </div>
          )
        })}
        {formulaCols.map(c => {
          const hasRollup = !!(c.settings as Record<string, unknown>)?.rollup_up
          return (
            <div key={c.id} className="relative flex-none text-[var(--brand)] group/col" style={{ width: cw(c.id) }}>
              <div className="flex items-center gap-1 overflow-hidden pr-3">
                <span className="flex-1 truncate min-w-0">{c.name}</span>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    const ru = (c.settings as Record<string, unknown>)?.rollup_up as { aggregate?: string; board_col_id?: string } | undefined
                    setRollupTarget({ colId: c.id, colKey: c.col_key, colName: c.name, colKind: c.kind, currentAggregate: ru?.aggregate, currentBoardColId: ru?.board_col_id })
                  }}
                  title={hasRollup ? 'Resumen activo — click para editar' : 'Agregar resumen al item'}
                  className={`shrink-0 text-[11px] leading-none transition-opacity px-0.5 font-bold ${hasRollup ? 'text-[var(--brand)]' : 'opacity-0 group-hover/col:opacity-100 text-[var(--ink-4)] hover:text-[var(--brand)]'}`}
                >↑</button>
                {isBoardAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); setColSettings(c) }}
                    title="Configurar columna"
                    className="opacity-0 group-hover/col:opacity-100 shrink-0 text-[14px] leading-none text-[var(--ink-4)] hover:text-[var(--brand)] transition-opacity px-0.5"
                  >⋯</button>
                )}
              </div>
              <div onMouseDown={e => startResize(c.id, 96, e)} className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none z-10 group/resizer" onClick={e => e.stopPropagation()}>
                <div className="h-4 w-px rounded-full bg-[var(--border)] group-hover/resizer:bg-[var(--brand-soft)] transition-colors" />
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
            className="w-7 flex-none flex items-center justify-center text-[var(--ink-4)] hover:text-[var(--brand)] transition-colors normal-case font-normal tracking-normal"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <div className="w-7 flex-none" />
      </div>

      {/* ── Rows ──────────────────────────────────────────────────────── */}
      <div>
        {rows.length === 0 && (
          <div className="flex items-center justify-center py-10 text-[13px] text-[var(--ink-3)] italic">
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
                workspaceSid={workspaceSid}
                conditionalOptions={conditionalOptions[row.id]}
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
                    workspaceSid={workspaceSid}
                    conditionalOptions={conditionalOptions[child.id]}
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
        <div className="flex items-center gap-2 px-4 py-1 border-t border-[var(--border)] bg-[var(--surface-2)] flex-none text-[11px] select-none sticky bottom-0 z-10">
          <div className="flex-none" style={{ width: cw('__expand') }} />
          <div className="flex-none text-[var(--ink-4)] italic" style={{ width: cw('__name') }}>Totales</div>
          {displayCols.map(col => {
            const kindDefault = col.kind === 'image' || col.kind === 'file' ? 180 : 96
            if (col.kind !== 'number') return <div key={col.id} className="flex-none" style={{ width: cw(col.id, kindDefault) }} />
            const fn = colAggregates[col.id] ?? null
            const val = fn ? computeFooterAgg(col.id, col.kind, fn) : null
            return (
              <div
                key={col.id}
                className="flex-none text-right cursor-pointer group"
                style={{ width: cw(col.id, kindDefault) }}
                onClick={() => cycleAgg(col.id)}
                title={fn ? `${fn} — click para cambiar` : 'Click para agregar totales'}
              >
                {fn ? (
                  <span className="text-[var(--ink-2)] font-medium">
                    <span className="text-[var(--ink-4)] mr-1">{AGG_LABEL[fn]}</span>
                    {val != null ? val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                  </span>
                ) : (
                  <span className="text-[var(--ink-4)] opacity-40 group-hover:opacity-100 transition-opacity">+</span>
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
                  <span className="text-[var(--brand)] font-medium">
                    <span className="text-[var(--brand-soft)] mr-1">{AGG_LABEL[fn]}</span>
                    {val != null ? val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                  </span>
                ) : (
                  <span className="text-[var(--ink-4)] opacity-40 group-hover:opacity-100 transition-opacity">+</span>
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
                  <span className="text-[var(--brand)] font-medium">
                    <span className="text-[var(--brand-soft)] mr-1">{AGG_LABEL[fn]}</span>
                    {val != null ? val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                  </span>
                ) : (
                  <span className="text-[var(--ink-4)] opacity-40 group-hover:opacity-100 transition-opacity">+</span>
                )}
              </div>
            )
          })}
          <div className="w-7 flex-none" />
        </div>
      )}

      </div>
      </div>
      {/* ── end scrollable region ───────────────────────────────────────── */}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex-none border-t border-[var(--border)] px-4 py-2 flex items-center justify-between gap-3">
        {sourceBoardId ? (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 text-[13px] text-[var(--brand)] hover:text-[var(--brand-deep)] font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Nuevo
          </button>
        ) : (
          <InlineAddButton onAdd={name => createL1(name)} />
        )}
        {canExpandVariants && (
          <button
            onClick={() => setExpandModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--brand)] transition-colors"
            title="Genera variantes desde las listas de tallas/colores del producto"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M3 6h6M6 3v6" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="1.5" y="1.5" width="9" height="9" strokeWidth="1.2" rx="1"/>
            </svg>
            Expandir variantes
          </button>
        )}
      </div>

      {/* ── Mandar a cotización CTA (opp → quote snapshot) ─────────────────── */}
      {canMaterializeQuote && (
        <div className="flex-none border-t border-[var(--border)] px-4 py-3 flex items-center gap-2.5 bg-[var(--surface-2)]">
          <button
            onClick={materializeQuote}
            disabled={materializing || rows.length === 0}
            title={rows.length === 0 ? 'Añade al menos una partida' : 'Crea una cotización inmutable a partir de este catálogo'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--brand-ink)] bg-[var(--brand)] hover:bg-[var(--brand-deep)] rounded-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            {materializing ? 'Creando…' : 'Mandar a cotización'}
          </button>
        </div>
      )}
      {materializeError && (
        <div className="flex-none border-t border-[var(--stage-lost)] px-4 py-2 bg-[color-mix(in_oklab,var(--stage-lost)_8%,var(--surface)_92%)] text-[11.5px] text-[var(--stage-lost)]">
          {materializeError}
        </div>
      )}

      </div>{/* /card wrapper */}

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
          column={{ ...colSettings, is_system: colSettings.is_system ?? false }}
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
      {expandModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center" onClick={() => !expanding && setExpandModalOpen(false)}>
          <div className="bg-[var(--bg)] rounded-sm shadow-lg w-[360px] border border-[var(--border)]" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <div className="text-[14px] font-medium text-[var(--ink-1)]">Expandir variantes</div>
              <div className="text-[12px] text-[var(--ink-4)] mt-0.5">Genera combinaciones a partir de las listas del producto.</div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" checked={expandUseTallas} onChange={e => setExpandUseTallas(e.target.checked)} />
                <span>Tallas</span>
                <span className="text-[11px] text-[var(--ink-4)] ml-auto">col: tallas</span>
              </label>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" checked={expandUseColores} onChange={e => setExpandUseColores(e.target.checked)} />
                <span>Colores</span>
                <span className="text-[11px] text-[var(--ink-4)] ml-auto">col: colores_disponibles</span>
              </label>
              {!expandUseTallas && !expandUseColores && (
                <div className="text-[11.5px] text-[var(--ink-4)] italic pt-1">Selecciona al menos una dimensión.</div>
              )}
              {expandError && (
                <div className="text-[11.5px] text-[var(--stage-lost)] pt-1">{expandError}</div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
              <button
                onClick={() => setExpandModalOpen(false)}
                disabled={expanding}
                className="px-3 py-1.5 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={runExpand}
                disabled={expanding || (!expandUseTallas && !expandUseColores)}
                className="px-3 py-1.5 text-[13px] font-medium text-[var(--brand-ink)] bg-[var(--brand)] hover:bg-[var(--brand-deep)] rounded-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {expanding ? 'Expandiendo…' : 'Expandir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NativeRow ────────────────────────────────────────────────────────────────

function NativeRow({
  row, depth, isExpanded, displayCols, formulaCols, rollupCols, editTarget,
  onToggleExpand, onStartEdit, onCommit, onCancel, onDelete, onAddChild,
  computeFormula, onExpandVariants, onOpenDetail, isLocked, onImportChildren, onRefresh,
  colWidths, workspaceSid, conditionalOptions,
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
  workspaceSid?: number
  conditionalOptions?: Record<string, string[]>  // { col_key: options[] } for this row
}) {
  const isEditing = (f: string) => editTarget?.id === row.id && editTarget.field === f
  const indent    = depth === 1 ? 'pl-5' : ''

  function w(key: string, def = 96): number {
    return colWidths[key] ?? def
  }

  return (
    <div className={`flex items-center gap-2 px-4 py-1 hover:bg-[var(--surface-2)] group border-b border-[var(--border)] ${indent}`}>
      {/* Chevron */}
      <div className="flex-none flex items-center justify-center" style={{ width: w('__expand', 20) }}>
        {depth === 0 ? (
          <button onClick={onToggleExpand} className="text-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors p-0.5 rounded">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d={isExpanded ? 'M2 4l4 4 4-4' : 'M4 2l4 4-4 4'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="text-[var(--ink-4)] text-[10px]">└</span>
        )}
      </div>

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
          // No permission: render empty cell
          return (
            <div key={col.id} className="flex-none bg-[var(--surface-2)] h-full w-full" style={{ width: w(col.id, 96) }} title="Sin permiso" />
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

        if (col.kind === 'image') {
          const imageValue = (val?.value_json as unknown as { name: string; path?: string; thumb_path?: string; url?: string; size: number; mime?: string }[] | null) ?? null
          return (
            <div key={col.id} className="relative flex-none" style={{ width: w(col.id, 180) }} onClick={e => e.stopPropagation()}>
              <ImageCell
                value={imageValue as unknown as CellValue}
                isEditing={false}
                column={{ key: col.col_key, label: col.name, kind: 'image', settings: col.settings ?? {} }}
                rowId={row.id}
                filesBase={`/api/sub-items/${row.id}/files`}
                size={56}
                onStartEdit={() => {}}
                onCommit={v => onCommit(col.id, v)}
                onCancel={() => {}}
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

        if (col.kind === 'conditional_select') {
          // Options come from the parent item (via source_item_id) — resolved server-side.
          const rawOpts = conditionalOptions?.[col.col_key] ?? []
          const opts = rawOpts.map(v => ({ value: v, label: v }))
          return (
            <div key={col.id} className="relative flex-none" style={{ width: w(col.id, 96) }} onClick={e => e.stopPropagation()}>
              {opts.length === 0 ? (
                <div className="w-full h-full px-2.5 py-2 text-[12px] text-[var(--ink-4)] italic truncate" title="Sin opciones — configúralas en Catálogo">
                  —
                </div>
              ) : (
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
              )}
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
          <div key={col.id} className="relative flex-none text-right text-[13px] text-[var(--brand)] font-medium" style={{ width: w(col.id, 96) }}>
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
          <div key={col.id} className="relative flex-none text-right text-[13px] text-[var(--brand)] font-medium" style={{ width: w(col.id, 96) }}>
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
        {row.source_board_sid && row.source_item_sid && workspaceSid ? (
          <a
            href={`/app/w/${workspaceSid}/b/${row.source_board_sid}/${row.source_item_sid}`}
            title="Ver en catálogo"
            className="text-[var(--ink-3)] hover:text-[var(--brand)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        ) : (
          <button onClick={onOpenDetail} title="Abrir detalle" className="text-[var(--ink-3)] hover:text-[var(--brand)] transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {depth === 0 && row.source_item_id && onImportChildren && (
          <button onClick={onImportChildren} title="Jalar sub-items del catálogo" className="text-[var(--ink-3)] hover:text-[var(--brand)] transition-colors">
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
            className={`transition-colors ${isLocked ? 'text-[var(--ink-4)] cursor-not-allowed' : 'text-[var(--ink-3)] hover:text-[var(--brand)]'}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M10 6A4 4 0 1 1 7 2.1M10 2v3H7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {depth === 0 && (
          <button onClick={onAddChild} title="Agregar L2" className="text-[var(--ink-3)] hover:text-[var(--brand)] transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {depth === 0 && onExpandVariants && (
          <button onClick={onExpandVariants} title="Explotar variantes" className="text-[var(--ink-3)] hover:text-[var(--brand)] transition-colors text-[10px]">⚡</button>
        )}
        <button onClick={onDelete} title="Eliminar" className="text-[var(--ink-3)] hover:text-[var(--stage-lost)] transition-colors">
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
      className={`text-[13px] px-1 py-0.5 rounded cursor-text hover:bg-[var(--surface-2)] transition-colors truncate ${align === 'right' ? 'text-right' : ''} ${isEmpty ? 'text-[var(--ink-3)]' : 'text-[var(--ink)]'}`}
    >
      {isEmpty ? '—' : display}
    </div>
  )
}

// ─── InlineAddRow ─────────────────────────────────────────────────────────────

function InlineAddRow({ depth, onAdd, onCancel }: { depth: number; onAdd: (n: string) => void; onCancel: () => void }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-1 border-b border-[var(--border)] ${depth === 1 ? 'pl-10' : 'pl-7'}`}>
      <input
        autoFocus placeholder="Nombre..."
        className="flex-1 text-[13px] border border-[var(--brand)] rounded px-2 py-0.5 outline-none"
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
    <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-[13px] text-[var(--brand)] hover:text-[var(--brand-deep)] font-medium transition-colors">
      <span className="text-lg leading-none">+</span> Nuevo
    </button>
  )
  return <InlineAddRow depth={0} onAdd={n => { onAdd(n); setAdding(false) }} onCancel={() => setAdding(false)} />
}

