'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { ProductPicker } from './ProductPicker'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubItem = {
  id:              string
  sid:             number
  parent_id:       string | null
  depth:           0 | 1
  name:            string
  qty:             number
  unit_price:      number
  notes:           string | null
  catalog_item_id: string | null
  position:        number
  children?:       SubItem[]
}

type EditTarget = { id: string; field: 'name' | 'qty' | 'unit_price' | 'notes' } | null

export type SubItemLevels = {
  l1: string   // e.g. "Producto"
  l2: string   // e.g. "Variante"
}

/**
 * Describes a source from which sub-items can be added.
 * In Phase 8 (Board Settings), boards will configure arbitrary sources
 * (e.g. "Oportunidades", "Instituciones"). For now only catalog L1/L2 are used.
 */
export type SubItemSourceConfig = {
  id:       string           // stable key ("l1", "l2", or future board slug)
  label:    string           // display name shown in the selector
  depth:    0 | 1           // which sub-item level this source populates
  boardId?: string | null   // catalog/reference board for picker; null = manual text entry
}

function buildDefaultSources(levels: SubItemLevels, catalogBoardId: string | null): SubItemSourceConfig[] {
  return [
    { id: 'l1', label: levels.l1,                       depth: 0, boardId: catalogBoardId },
    { id: 'l2', label: `${levels.l2} de ${levels.l1}`,  depth: 1, boardId: null },
  ]
}

type Props = {
  itemId:         string
  levels:         SubItemLevels
  catalogBoardId: string | null
  /** Override default sources — set via board settings in Phase 8 */
  sources?:       SubItemSourceConfig[]
  onCountChange?: (count: number) => void   // notify parent of L1 count
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InlineSubItems({ itemId, levels, catalogBoardId, sources, onCountChange }: Props) {
  const resolvedSources = sources ?? buildDefaultSources(levels, catalogBoardId)

  const [rows,             setRows]             = useState<SubItem[]>([])
  const [loading,          setLoading]          = useState(true)
  const [expandedL1,       setExpandedL1]       = useState<Set<string>>(new Set())
  const [editTarget,       setEditTarget]       = useState<EditTarget>(null)
  const [showPicker,       setShowPicker]       = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState<string>(resolvedSources[0]?.id ?? 'l1')

  // Add form state
  const [addDepth,    setAddDepth]    = useState<0 | 1>(0)
  const [addParentId, setAddParentId] = useState<string | null>(null)
  const [addName,     setAddName]     = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  const selectedSource = resolvedSources.find(s => s.id === selectedSourceId) ?? resolvedSources[0]

  // Stable ref so load() doesn't re-create when onCountChange identity changes
  const onCountChangeRef = useRef(onCountChange)
  useEffect(() => { onCountChangeRef.current = onCountChange })

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/sub-items?itemId=${itemId}`)
    const flat = (await res.json()) as SubItem[]

    const l1Map: Record<string, SubItem> = {}
    const l1: SubItem[] = []
    for (const r of flat) {
      if (r.depth === 0) { l1Map[r.id] = { ...r, children: [] }; l1.push(l1Map[r.id]) }
    }
    for (const r of flat) {
      if (r.depth === 1 && r.parent_id && l1Map[r.parent_id]) {
        l1Map[r.parent_id].children!.push(r)
      }
    }
    setRows(l1)
    onCountChangeRef.current?.(l1.length)
    setLoading(false)
  }, [itemId])   // ← solo itemId; onCountChange via ref, sin loop

  useEffect(() => { load() }, [load])

  // Focus add input when form opens
  useEffect(() => {
    if (showAddForm) setTimeout(() => addInputRef.current?.focus(), 50)
  }, [showAddForm])

  // ── Create ──────────────────────────────────────────────────────────────────

  const submitAdd = useCallback(async (name: string, catalogItemId?: string, unitPrice?: number) => {
    if (!name.trim()) return
    setAddName('')
    setShowAddForm(false)

    const res = await fetch('/api/sub-items', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        item_id:         itemId,
        name:            name.trim(),
        depth:           addDepth,
        parent_id:       addDepth === 1 ? addParentId : null,
        catalog_item_id: catalogItemId ?? null,
        unit_price:      unitPrice ?? 0,
      }),
    })
    const created = (await res.json()) as SubItem

    if (addDepth === 0) {
      setRows(prev => {
        const next = [...prev, { ...created, children: [] }]
        onCountChange?.(next.length)
        return next
      })
    } else {
      setRows(prev => prev.map(r =>
        r.id === addParentId
          ? { ...r, children: [...(r.children ?? []), created] }
          : r
      ))
      if (addParentId) setExpandedL1(s => new Set([...s, addParentId]))
    }
  }, [itemId, addDepth, addParentId, onCountChange])

  // ── Patch ───────────────────────────────────────────────────────────────────

  const patch = useCallback(async (id: string, field: string, value: unknown) => {
    setRows(prev => patchTree(prev, id, { [field]: value }))
    setEditTarget(null)
    await fetch(`/api/sub-items/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ [field]: value }),
    })
  }, [])

  // ── Delete ──────────────────────────────────────────────────────────────────

  const remove = useCallback(async (id: string, depth: 0 | 1, parentId: string | null) => {
    if (depth === 0) {
      setRows(prev => {
        const next = prev.filter(r => r.id !== id)
        onCountChange?.(next.length)
        return next
      })
    } else {
      setRows(prev => prev.map(r =>
        r.id === parentId
          ? { ...r, children: (r.children ?? []).filter(c => c.id !== id) }
          : r
      ))
    }
    await fetch(`/api/sub-items/${id}`, { method: 'DELETE' })
  }, [onCountChange])

  // ── Add form helpers ────────────────────────────────────────────────────────

  const openAddForm = (depth: 0 | 1, parentId: string | null = null) => {
    setAddDepth(depth)
    setAddParentId(parentId)
    setAddName('')
    setShowAddForm(true)
  }

  // Dispatches to picker or add form based on the selected source
  const handleAgregar = () => {
    if (!selectedSource) return
    if (selectedSource.depth === 0 && selectedSource.boardId) {
      setAddDepth(0)
      setShowPicker(true)
    } else if (selectedSource.depth === 0) {
      openAddForm(0, null)
    } else {
      // L2: default to first L1 parent (user can change in AddForm)
      openAddForm(1, rows[0]?.id ?? null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-8 py-3 text-[12px] text-gray-400">Cargando...</div>
    )
  }

  const totalL1 = rows.reduce((s, r) => s + r.qty * r.unit_price, 0)
  const colLabel = selectedSource?.depth === 0 ? levels.l1 : levels.l2

  return (
    <div className="py-2">

      {/* Top bar: source selector + agregar */}
      <div className="flex items-center justify-between px-8 pb-1.5">
        <SourceSelector
          sources={resolvedSources}
          selectedId={selectedSourceId}
          onSelect={id => { setSelectedSourceId(id); setShowAddForm(false) }}
        />
        {!showAddForm && (
          <button
            onClick={handleAgregar}
            className="flex items-center gap-1 text-[12px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <span className="text-[15px] leading-none">+</span> Agregar
          </button>
        )}
      </div>

      {/* Sub-item rows */}
      {rows.length > 0 && (
        <table className="w-full border-collapse mb-1 px-8" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 32 }} />    {/* indent/expand */}
            <col style={{ width: 56 }} />    {/* sid */}
            <col />                           {/* name */}
            <col style={{ width: 60 }} />    {/* qty */}
            <col style={{ width: 88 }} />    {/* unit price */}
            <col style={{ width: 88 }} />    {/* total */}
            <col style={{ width: 120 }} />   {/* notes */}
            <col style={{ width: 28 }} />    {/* actions */}
          </colgroup>
          <thead>
            <tr className="text-[10px] text-gray-400 uppercase tracking-wide">
              <th />
              <th className="text-left pb-1 font-semibold pl-8">#</th>
              <th className="text-left pb-1 font-semibold">{colLabel}</th>
              <th className="text-right pb-1 font-semibold">Cant.</th>
              <th className="text-right pb-1 font-semibold">Precio</th>
              <th className="text-right pb-1 font-semibold">Total</th>
              <th className="text-left pb-1 font-semibold">Notas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <Fragment key={row.id}>
                {/* L1 row */}
                <SubItemRow
                  row={row}
                  depth={0}
                  isExpanded={expandedL1.has(row.id)}
                  editTarget={editTarget}
                  onToggleExpand={() => setExpandedL1(s => {
                    const n = new Set(s); n.has(row.id) ? n.delete(row.id) : n.add(row.id); return n
                  })}
                  onStartEdit={f => setEditTarget({ id: row.id, field: f })}
                  onCommit={(f, v) => patch(row.id, f, v)}
                  onCancel={() => setEditTarget(null)}
                  onDelete={() => remove(row.id, 0, null)}
                  onAddChild={() => openAddForm(1, row.id)}
                  l2Label={levels.l2}
                />
                {/* L2 rows */}
                {expandedL1.has(row.id) && (row.children ?? []).map(child => (
                  <SubItemRow
                    key={child.id}
                    row={child}
                    depth={1}
                    isExpanded={false}
                    editTarget={editTarget}
                    onToggleExpand={() => {}}
                    onStartEdit={f => setEditTarget({ id: child.id, field: f })}
                    onCommit={(f, v) => patch(child.id, f, v)}
                    onCancel={() => setEditTarget(null)}
                    onDelete={() => remove(child.id, 1, row.id)}
                    onAddChild={() => {}}
                    l2Label={levels.l2}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={5} className="pt-1 text-[11px] text-gray-400 text-right pr-2">
                  Total
                </td>
                <td className="pt-1 text-[12px] text-gray-700 font-semibold text-right">
                  ${totalL1.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {rows.length === 0 && !showAddForm && (
        <p className="px-8 text-[12px] text-gray-400 italic mb-1">
          Sin {colLabel.toLowerCase()}s
        </p>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="px-8">
          <AddForm
            ref={addInputRef}
            depth={addDepth}
            parentId={addParentId}
            rows={rows}
            levels={levels}
            catalogBoardId={catalogBoardId}
            value={addName}
            onChange={setAddName}
            onDepthChange={d => setAddDepth(d)}
            onParentChange={id => setAddParentId(id)}
            onSubmit={submitAdd}
            onCancel={() => setShowAddForm(false)}
            onShowPicker={() => setShowPicker(true)}
          />
        </div>
      )}

      {/* Product picker */}
      {showPicker && catalogBoardId && (
        <ProductPicker
          catalogBoardId={catalogBoardId}
          onSelect={({ name, unit_price, id }) => {
            submitAdd(name, id, unit_price ?? undefined)
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ─── SourceSelector ───────────────────────────────────────────────────────────
// Shows which "source" of sub-items is active. Drives what "Agregar" adds.
// Future: board settings will populate `sources` with arbitrary boards.

function SourceSelector({
  sources, selectedId, onSelect,
}: {
  sources:    SubItemSourceConfig[]
  selectedId: string
  onSelect:   (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = sources.find(s => s.id === selectedId) ?? sources[0]

  if (sources.length <= 1) {
    // Single source — no need for a dropdown
    return (
      <span className="text-[12px] font-semibold text-gray-600">
        {selected?.label}
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 hover:text-gray-900 transition-colors"
      >
        {selected?.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current mt-0.5 text-gray-400">
          <path d="M2 3.5l3 3 3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[200px] py-1 overflow-hidden">
            {sources.map(s => (
              <button
                key={s.id}
                onClick={() => { onSelect(s.id); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-indigo-50 transition-colors ${
                  s.id === selectedId ? 'text-indigo-700 font-medium' : 'text-gray-700'
                }`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold flex-none ${
                  s.depth === 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {s.depth + 1}
                </span>
                {s.label}
                {s.id === selectedId && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-indigo-500 ml-auto flex-none">
                    <path d="M2 6l3 3 5-5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── AddForm ──────────────────────────────────────────────────────────────────

import { forwardRef } from 'react'

const AddForm = forwardRef<HTMLInputElement, {
  depth:          0 | 1
  parentId:       string | null
  rows:           SubItem[]
  levels:         SubItemLevels
  catalogBoardId: string | null
  value:          string
  onChange:       (v: string) => void
  onDepthChange:  (d: 0 | 1) => void
  onParentChange: (id: string | null) => void
  onSubmit:       (name: string) => void
  onCancel:       () => void
  onShowPicker:   () => void
}>(function AddForm({
  depth, parentId, rows, levels, catalogBoardId,
  value, onChange, onDepthChange, onParentChange,
  onSubmit, onCancel, onShowPicker,
}, ref) {
  const parentName = rows.find(r => r.id === parentId)?.name ?? ''

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Level badge */}
      <div className="flex items-center gap-1 flex-none">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
          depth === 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {depth === 0 ? levels.l1 : `${levels.l2} › ${parentName}`}
        </span>
      </div>

      {/* Name input */}
      {catalogBoardId && depth === 0 ? (
        <button
          onClick={onShowPicker}
          className="flex-1 text-[12px] text-left px-2 py-1 rounded border border-indigo-300 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
        >
          Buscar en catálogo...
        </button>
      ) : (
        <input
          ref={ref}
          type="text"
          placeholder={`Nombre del ${depth === 0 ? levels.l1.toLowerCase() : levels.l2.toLowerCase()}...`}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 text-[12px] px-2 py-1 rounded border border-indigo-300 outline-none focus:border-indigo-500 bg-white"
          onKeyDown={e => {
            if (e.key === 'Enter' && value.trim()) onSubmit(value)
            if (e.key === 'Escape') onCancel()
          }}
        />
      )}

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="flex-none text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
          <path d="M2 2l8 8M10 2l-8 8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
})

// ─── SubItemRow ───────────────────────────────────────────────────────────────

function SubItemRow({
  row, depth, isExpanded, editTarget,
  onToggleExpand, onStartEdit, onCommit, onCancel, onDelete, onAddChild, l2Label,
}: {
  row:            SubItem
  depth:          0 | 1
  isExpanded:     boolean
  editTarget:     EditTarget
  onToggleExpand: () => void
  onStartEdit:    (f: 'name' | 'qty' | 'unit_price' | 'notes') => void
  onCommit:       (f: string, v: unknown) => void
  onCancel:       () => void
  onDelete:       () => void
  onAddChild:     () => void
  l2Label:        string
}) {
  const isEditing = (f: 'name' | 'qty' | 'unit_price' | 'notes') =>
    editTarget?.id === row.id && editTarget.field === f

  const total = row.qty * row.unit_price

  return (
    <tr className="group/si hover:bg-white/60 transition-colors">
      {/* Expand chevron or L2 indicator */}
      <td className="py-0.5">
        {depth === 0 ? (
          <button
            onClick={onToggleExpand}
            className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`stroke-current transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              <path d="M3 1.5l3.5 3.5L3 8.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="text-gray-300 text-[10px] pl-1">└</span>
        )}
      </td>

      {/* SID */}
      <td className={`py-0.5 text-[11px] text-gray-400 font-mono ${depth === 1 ? 'pl-3' : ''}`}>
        {row.sid}
      </td>

      {/* Name */}
      <td className="py-0.5">
        <InlineEdit
          value={row.name}
          isEditing={isEditing('name')}
          kind="text"
          onStart={() => onStartEdit('name')}
          onCommit={v => onCommit('name', v)}
          onCancel={onCancel}
        />
      </td>

      {/* Qty */}
      <td className="py-0.5 text-right">
        <InlineEdit
          value={row.qty}
          isEditing={isEditing('qty')}
          kind="number"
          onStart={() => onStartEdit('qty')}
          onCommit={v => onCommit('qty', Number(v))}
          onCancel={onCancel}
          align="right"
        />
      </td>

      {/* Unit price */}
      <td className="py-0.5 text-right">
        <InlineEdit
          value={row.unit_price}
          isEditing={isEditing('unit_price')}
          kind="number"
          onStart={() => onStartEdit('unit_price')}
          onCommit={v => onCommit('unit_price', Number(v))}
          onCancel={onCancel}
          align="right"
          prefix="$"
        />
      </td>

      {/* Total */}
      <td className="py-0.5 text-right text-[12px] text-gray-700 font-medium pr-1">
        ${total.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
      </td>

      {/* Notes */}
      <td className="py-0.5">
        <InlineEdit
          value={row.notes ?? ''}
          isEditing={isEditing('notes')}
          kind="text"
          onStart={() => onStartEdit('notes')}
          onCommit={v => onCommit('notes', v || null)}
          onCancel={onCancel}
          placeholder="—"
        />
      </td>

      {/* Actions */}
      <td className="py-0.5">
        <div className="flex items-center gap-1 opacity-0 group-hover/si:opacity-100 transition-opacity">
          {depth === 0 && (
            <button
              onClick={onAddChild}
              title={`Agregar ${l2Label}`}
              className="text-gray-400 hover:text-indigo-500 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current">
                <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button
            onClick={onDelete}
            title="Eliminar"
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M2 2l8 8M10 2l-8 8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── InlineEdit ───────────────────────────────────────────────────────────────

function InlineEdit({
  value, isEditing, kind, onStart, onCommit, onCancel, align = 'left', prefix, placeholder,
}: {
  value:        string | number
  isEditing:    boolean
  kind:         'text' | 'number'
  onStart:      () => void
  onCommit:     (v: string | number) => void
  onCancel:     () => void
  align?:       'left' | 'right'
  prefix?:      string
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (isEditing) ref.current?.select() }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={ref}
        autoFocus
        defaultValue={String(value)}
        type={kind === 'number' ? 'number' : 'text'}
        className={`w-full text-[12px] bg-white border border-indigo-400 rounded px-1 py-0 outline-none ${align === 'right' ? 'text-right' : ''}`}
        onBlur={e => onCommit(kind === 'number' ? Number(e.target.value) : e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  onCommit(kind === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)
          if (e.key === 'Escape') onCancel()
        }}
      />
    )
  }

  const empty = value === '' || (value === 0 && kind === 'text')
  return (
    <div
      onClick={onStart}
      className={`text-[12px] px-1 py-0 rounded cursor-text hover:bg-white/80 transition-colors truncate ${
        align === 'right' ? 'text-right' : ''
      } ${empty ? 'text-gray-300' : 'text-gray-800'}`}
    >
      {!empty && prefix}{empty ? (placeholder ?? '—') : value}
    </div>
  )
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function patchTree(rows: SubItem[], id: string, patch: Partial<SubItem>): SubItem[] {
  return rows.map(r => {
    if (r.id === id) return { ...r, ...patch }
    if (r.children) return { ...r, children: patchTree(r.children, id, patch) }
    return r
  })
}
