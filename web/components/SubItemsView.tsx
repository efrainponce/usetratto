'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  children?:       SubItem[]     // populated client-side for L1 rows
}

type EditTarget = { id: string; field: 'name' | 'qty' | 'unit_price' | 'notes' } | null

type Props = {
  itemId:         string
  catalogBoardId: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubItemsView({ itemId, catalogBoardId }: Props) {
  const [rows,       setRows]       = useState<SubItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [addingL2For, setAddingL2For] = useState<string | null>(null)  // parent_id for new L2

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/sub-items?itemId=${itemId}`)
    const flat = (await res.json()) as SubItem[]

    // Group L2 under L1
    const l1Map: Record<string, SubItem> = {}
    const l1: SubItem[] = []

    for (const row of flat) {
      if (row.depth === 0) {
        l1Map[row.id] = { ...row, children: [] }
        l1.push(l1Map[row.id])
      }
    }
    for (const row of flat) {
      if (row.depth === 1 && row.parent_id && l1Map[row.parent_id]) {
        l1Map[row.parent_id].children!.push(row)
      }
    }

    setRows(l1)
    setLoading(false)
  }, [itemId])

  useEffect(() => { load() }, [load])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const patch = useCallback(async (id: string, field: string, value: unknown) => {
    // Optimistic update
    setRows(prev => patchTree(prev, id, { [field]: value }))
    setEditTarget(null)
    await fetch(`/api/sub-items/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ [field]: value }),
    })
  }, [])

  const remove = useCallback(async (id: string, depth: 0 | 1, parentId: string | null) => {
    // Optimistic removal
    if (depth === 0) {
      setRows(prev => prev.filter(r => r.id !== id))
    } else {
      setRows(prev => prev.map(r =>
        r.id === parentId
          ? { ...r, children: (r.children ?? []).filter(c => c.id !== id) }
          : r
      ))
    }
    await fetch(`/api/sub-items/${id}`, { method: 'DELETE' })
  }, [])

  const createL1 = useCallback(async (name: string, catalogItemId?: string, unitPrice?: number) => {
    const res  = await fetch('/api/sub-items', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        item_id:         itemId,
        name,
        catalog_item_id: catalogItemId ?? null,
        unit_price:      unitPrice ?? 0,
      }),
    })
    const created = await res.json() as SubItem
    setRows(prev => [...prev, { ...created, children: [] }])
  }, [itemId])

  const createL2 = useCallback(async (parentId: string, name: string) => {
    const res  = await fetch('/api/sub-items', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ item_id: itemId, name, parent_id: parentId, depth: 1 }),
    })
    const created = await res.json() as SubItem
    setRows(prev => prev.map(r =>
      r.id === parentId
        ? { ...r, children: [...(r.children ?? []), created] }
        : r
    ))
    setExpanded(s => new Set([...s, parentId]))
    setAddingL2For(null)
  }, [itemId])

  // ── Toggle expand ──────────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[13px] text-gray-400">
        Cargando...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Table header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide select-none">
        <div className="w-5 flex-none" />           {/* chevron */}
        <div className="w-16 flex-none">#</div>     {/* sid */}
        <div className="flex-1 min-w-0">Nombre</div>
        <div className="w-16 flex-none text-right">Cant.</div>
        <div className="w-24 flex-none text-right">Precio</div>
        <div className="w-24 flex-none text-right">Total</div>
        <div className="w-32 flex-none">Notas</div>
        <div className="w-7 flex-none" />           {/* delete */}
      </div>

      {/* ── Rows ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="flex items-center justify-center py-12 text-[13px] text-gray-400 italic">
            Sin sub-items
          </div>
        )}

        {rows.map(row => (
          <div key={row.id}>

            {/* L1 row */}
            <SubItemRow
              row={row}
              depth={0}
              isExpanded={expanded.has(row.id)}
              editTarget={editTarget}
              onToggleExpand={() => toggleExpand(row.id)}
              onStartEdit={(field) => setEditTarget({ id: row.id, field })}
              onCommit={(field, val) => patch(row.id, field, val)}
              onCancel={() => setEditTarget(null)}
              onDelete={() => remove(row.id, 0, null)}
              onAddChild={() => { setExpanded(s => new Set([...s, row.id])); setAddingL2For(row.id) }}
            />

            {/* L2 rows (when expanded) */}
            {expanded.has(row.id) && (
              <>
                {(row.children ?? []).map(child => (
                  <SubItemRow
                    key={child.id}
                    row={child}
                    depth={1}
                    isExpanded={false}
                    editTarget={editTarget}
                    onToggleExpand={() => {}}
                    onStartEdit={(field) => setEditTarget({ id: child.id, field })}
                    onCommit={(field, val) => patch(child.id, field, val)}
                    onCancel={() => setEditTarget(null)}
                    onDelete={() => remove(child.id, 1, row.id)}
                    onAddChild={() => {}}
                  />
                ))}

                {/* Inline L2 add row */}
                {addingL2For === row.id && (
                  <InlineAddRow
                    depth={1}
                    onAdd={(name) => createL2(row.id, name)}
                    onCancel={() => setAddingL2For(null)}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer: add L1 ──────────────────────────────────────────────── */}
      <div className="flex-none border-t border-gray-100 px-4 py-2 flex items-center gap-3">
        {catalogBoardId ? (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 text-[13px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Agregar desde catálogo
          </button>
        ) : (
          <InlineAddButton onAdd={(name) => createL1(name)} />
        )}
      </div>

      {/* ── ProductPicker modal ──────────────────────────────────────────── */}
      {showPicker && catalogBoardId && (
        <ProductPicker
          catalogBoardId={catalogBoardId}
          onSelect={({ name, unit_price, id }) => {
            createL1(name, id, unit_price ?? undefined)
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ─── SubItemRow ───────────────────────────────────────────────────────────────

type RowProps = {
  row:           SubItem
  depth:         0 | 1
  isExpanded:    boolean
  editTarget:    EditTarget
  onToggleExpand: () => void
  onStartEdit:   (field: 'name' | 'qty' | 'unit_price' | 'notes') => void
  onCommit:      (field: string, value: unknown) => void
  onCancel:      () => void
  onDelete:      () => void
  onAddChild:    () => void
}

function SubItemRow({
  row, depth, isExpanded, editTarget,
  onToggleExpand, onStartEdit, onCommit, onCancel, onDelete, onAddChild,
}: RowProps) {
  const isEditing = (f: 'name' | 'qty' | 'unit_price' | 'notes') =>
    editTarget?.id === row.id && editTarget.field === f

  const indent = depth === 1 ? 'pl-5' : ''
  const total  = row.qty * row.unit_price

  return (
    <div className={`flex items-center gap-2 px-4 py-1 hover:bg-gray-50 group border-b border-gray-50 ${indent}`}>

      {/* Chevron (only L1 with children or ability to add) */}
      <div className="w-5 flex-none flex items-center justify-center">
        {depth === 0 && (
          <button
            onClick={onToggleExpand}
            className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path
                d={isExpanded ? 'M2 4l4 4 4-4' : 'M4 2l4 4-4 4'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {depth === 1 && <span className="text-gray-300 text-[10px]">└</span>}
      </div>

      {/* SID */}
      <div className="w-16 flex-none text-[12px] text-gray-400 font-mono">{row.sid}</div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <EditableCell
          value={row.name}
          isEditing={isEditing('name')}
          kind="text"
          onStartEdit={() => onStartEdit('name')}
          onCommit={v => onCommit('name', v)}
          onCancel={onCancel}
        />
      </div>

      {/* Qty */}
      <div className="w-16 flex-none text-right">
        <EditableCell
          value={row.qty}
          isEditing={isEditing('qty')}
          kind="number"
          onStartEdit={() => onStartEdit('qty')}
          onCommit={v => onCommit('qty', Number(v))}
          onCancel={onCancel}
          align="right"
        />
      </div>

      {/* Unit price */}
      <div className="w-24 flex-none text-right">
        <EditableCell
          value={row.unit_price}
          isEditing={isEditing('unit_price')}
          kind="number"
          onStartEdit={() => onStartEdit('unit_price')}
          onCommit={v => onCommit('unit_price', Number(v))}
          onCancel={onCancel}
          align="right"
          prefix="$"
        />
      </div>

      {/* Total (readonly) */}
      <div className="w-24 flex-none text-right text-[13px] text-gray-700 font-medium pr-1">
        ${total.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
      </div>

      {/* Notes */}
      <div className="w-32 flex-none">
        <EditableCell
          value={row.notes ?? ''}
          isEditing={isEditing('notes')}
          kind="text"
          onStartEdit={() => onStartEdit('notes')}
          onCommit={v => onCommit('notes', v || null)}
          onCancel={onCancel}
          placeholder="—"
        />
      </div>

      {/* Actions (visible on hover) */}
      <div className="w-7 flex-none flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {depth === 0 && (
          <button
            onClick={onAddChild}
            title="Agregar variante"
            className="text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          onClick={onDelete}
          title="Eliminar"
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
            <path d="M2 2l8 8M10 2l-8 8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

type EditableCellProps = {
  value:       string | number
  isEditing:   boolean
  kind:        'text' | 'number'
  onStartEdit: () => void
  onCommit:    (v: string | number) => void
  onCancel:    () => void
  align?:      'left' | 'right'
  prefix?:     string
  placeholder?: string
}

function EditableCell({
  value, isEditing, kind, onStartEdit, onCommit, onCancel, align = 'left', prefix, placeholder,
}: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        defaultValue={String(value)}
        type={kind === 'number' ? 'number' : 'text'}
        className={`w-full text-[13px] bg-white border border-indigo-400 rounded px-1 py-0.5 outline-none ${
          align === 'right' ? 'text-right' : ''
        }`}
        onBlur={e => onCommit(kind === 'number' ? Number(e.target.value) : e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  onCommit(kind === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)
          if (e.key === 'Escape') onCancel()
        }}
      />
    )
  }

  const display = value === '' || value === 0 && kind === 'text' ? (placeholder ?? '') : value
  const isEmpty = display === '' || display === (placeholder ?? '')

  return (
    <div
      onClick={onStartEdit}
      className={`text-[13px] px-1 py-0.5 rounded cursor-text hover:bg-gray-100 transition-colors truncate ${
        align === 'right' ? 'text-right' : ''
      } ${isEmpty ? 'text-gray-400' : 'text-gray-800'}`}
    >
      {!isEmpty && prefix}{isEmpty ? (placeholder ?? '—') : display}
    </div>
  )
}

// ─── InlineAddRow ─────────────────────────────────────────────────────────────

function InlineAddRow({
  depth,
  onAdd,
  onCancel,
}: {
  depth: 0 | 1
  onAdd:   (name: string) => void
  onCancel: () => void
}) {
  const indent = depth === 1 ? 'pl-10' : 'pl-7'
  return (
    <div className={`flex items-center gap-2 px-4 py-1 border-b border-gray-50 ${indent}`}>
      <input
        autoFocus
        placeholder="Nombre..."
        className="flex-1 text-[13px] border border-indigo-400 rounded px-2 py-0.5 outline-none"
        onKeyDown={e => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            onAdd(e.currentTarget.value.trim())
          }
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={e => {
          if (e.currentTarget.value.trim()) onAdd(e.currentTarget.value.trim())
          else onCancel()
        }}
      />
    </div>
  )
}

// ─── InlineAddButton ──────────────────────────────────────────────────────────

function InlineAddButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false)

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1.5 text-[13px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        <span className="text-lg leading-none">+</span>
        Agregar sub-item
      </button>
    )
  }

  return (
    <InlineAddRow
      depth={0}
      onAdd={name => { onAdd(name); setAdding(false) }}
      onCancel={() => setAdding(false)}
    />
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
