'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { ProductPicker } from './ProductPicker'

// ─── Types ────────────────────────────────────────────────────────────────────

type SubItemColumn = {
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

type SubItemValue = {
  column_id: string
  col_key: string
  value_text: string | null
  value_number: number | null
  value_date: string | null
  value_json: unknown
}

type SubItemData = {
  id: string
  sid: number
  parent_id: string | null
  depth: 0 | 1
  name: string
  source_item_id: string | null
  position: number
  values: SubItemValue[]
  children?: SubItemData[]
}

type ApiResponse = {
  columns: SubItemColumn[]
  items: SubItemData[]
}

type EditTarget = { id: string; field: string } | null

type Props = {
  itemId: string
  boardId: string
  subItemColumns: SubItemColumn[]
  sourceBoardId: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubItemsView({
  itemId,
  boardId,
  subItemColumns,
  sourceBoardId,
}: Props) {
  const [rows, setRows] = useState<SubItemData[]>([])
  const [columns, setColumns] = useState<SubItemColumn[]>(subItemColumns)
  const [loading, setLoading] = useState(true)
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [addingL2For, setAddingL2For] = useState<string | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sub-items?itemId=${itemId}`)
      const { columns: apiColumns, items: flat } = (await res.json()) as ApiResponse

      setColumns(apiColumns)

      // Build tree: L1 with children
      const l1Map: Record<string, SubItemData> = {}
      const l1: SubItemData[] = []

      for (const item of flat) {
        if (item.depth === 0) {
          l1Map[item.id] = { ...item, children: [] }
          l1.push(l1Map[item.id])
        }
      }

      for (const item of flat) {
        if (item.depth === 1 && item.parent_id && l1Map[item.parent_id]) {
          l1Map[item.parent_id].children!.push(item)
        }
      }

      setRows(l1)
    } catch (e) {
      console.error('Failed to load sub-items:', e)
    } finally {
      setLoading(false)
    }
  }, [itemId])

  useEffect(() => {
    load()
  }, [load])

  // ── Compute formula (client-side) ───────────────────────────────────────────

  function computeFormula(
    col: SubItemColumn,
    row: SubItemData
  ): number | null {
    if (col.kind !== 'formula') return null

    const s = col.settings as {
      formula: 'multiply' | 'add' | 'subtract' | 'percent'
      col_a: string
      col_b: string
    }

    const valsByKey: Record<string, number | null> = {}
    for (const v of row.values) {
      valsByKey[v.col_key] = v.value_number
    }

    const a = valsByKey[s.col_a]
    const b = valsByKey[s.col_b]
    if (a == null || b == null) return null

    switch (s.formula) {
      case 'multiply':
        return a * b
      case 'add':
        return a + b
      case 'subtract':
        return a - b
      case 'percent':
        return (a * b) / 100
      default:
        return null
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  const createL1 = useCallback(
    async (name: string, source_item_id?: string) => {
      if (!name.trim()) return

      try {
        const res = await fetch('/api/sub-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: itemId,
            name: name.trim(),
            depth: 0,
            source_item_id: source_item_id ?? null,
          }),
        })

        const created = (await res.json()) as SubItemData

        setRows((prev) => [...prev, { ...created, children: [] }])
      } catch (e) {
        console.error('Failed to create L1:', e)
      }
    },
    [itemId]
  )

  const createL2 = useCallback(
    async (parentId: string, name: string) => {
      if (!name.trim()) return

      try {
        const res = await fetch('/api/sub-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: itemId,
            parent_id: parentId,
            name: name.trim(),
            depth: 1,
          }),
        })

        const created = (await res.json()) as SubItemData

        setRows((prev) =>
          prev.map((r) =>
            r.id === parentId
              ? { ...r, children: [...(r.children ?? []), created] }
              : r
          )
        )

        setExpandedL1((s) => new Set([...s, parentId]))
        setAddingL2For(null)
      } catch (e) {
        console.error('Failed to create L2:', e)
      }
    },
    [itemId]
  )

  // ── Edit field ──────────────────────────────────────────────────────────────

  const editField = useCallback(
    async (id: string, field: string, value: unknown) => {
      setEditTarget(null)

      // Optimistic update
      setRows((prev) => patchTree(prev, id, { [field]: value }))

      try {
        if (field === 'name') {
          await fetch(`/api/sub-items/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: value }),
          })
        } else {
          // Assume field is a column_id
          const columnId = field
          await fetch(`/api/sub-items/${id}/values`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              column_id: columnId,
              value,
            }),
          })
        }
      } catch (e) {
        console.error('Failed to update:', e)
        load()
      }
    },
    [load]
  )

  // ── Delete ──────────────────────────────────────────────────────────────────

  const remove = useCallback(
    async (id: string, depth: 0 | 1, parentId: string | null) => {
      // Optimistic removal
      if (depth === 0) {
        setRows((prev) => prev.filter((r) => r.id !== id))
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === parentId
              ? { ...r, children: (r.children ?? []).filter((c) => c.id !== id) }
              : r
          )
        )
      }

      try {
        await fetch(`/api/sub-items/${id}`, { method: 'DELETE' })
      } catch (e) {
        console.error('Failed to delete:', e)
        load()
      }
    },
    [load]
  )

  const toggleExpand = (id: string) => {
    setExpandedL1((prev) => {
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

  const displayCols = columns.filter((c) => !c.is_hidden && c.kind !== 'formula')
  const formulaCols = columns.filter((c) => !c.is_hidden && c.kind === 'formula')

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide select-none">
        <div className="w-5 flex-none" />
        <div className="w-16 flex-none">#</div>
        <div className="w-40 flex-none">Nombre</div>
        {displayCols.map((c) => (
          <div key={c.id} className="w-24 flex-none text-right">
            {c.name}
          </div>
        ))}
        {formulaCols.map((c) => (
          <div key={c.id} className="w-24 flex-none text-right">
            {c.name}
          </div>
        ))}
        <div className="w-7 flex-none" />
      </div>

      {/* ── Rows ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="flex items-center justify-center py-12 text-[13px] text-gray-400 italic">
            Sin sub-items
          </div>
        )}

        {rows.map((row) => (
          <Fragment key={row.id}>
            <SubItemRow
              row={row}
              depth={0}
              isExpanded={expandedL1.has(row.id)}
              displayCols={displayCols}
              formulaCols={formulaCols}
              editTarget={editTarget}
              onToggleExpand={() => toggleExpand(row.id)}
              onStartEdit={(f) => setEditTarget({ id: row.id, field: f })}
              onCommit={(f, v) => editField(row.id, f, v)}
              onCancel={() => setEditTarget(null)}
              onDelete={() => remove(row.id, 0, null)}
              onAddChild={() => {
                setExpandedL1((s) => new Set([...s, row.id]))
                setAddingL2For(row.id)
              }}
              computeFormula={computeFormula}
            />

            {expandedL1.has(row.id) && (
              <>
                {(row.children ?? []).map((child) => (
                  <SubItemRow
                    key={child.id}
                    row={child}
                    depth={1}
                    isExpanded={false}
                    displayCols={displayCols}
                    formulaCols={formulaCols}
                    editTarget={editTarget}
                    onToggleExpand={() => {}}
                    onStartEdit={(f) => setEditTarget({ id: child.id, field: f })}
                    onCommit={(f, v) => editField(child.id, f, v)}
                    onCancel={() => setEditTarget(null)}
                    onDelete={() => remove(child.id, 1, row.id)}
                    onAddChild={() => {}}
                    computeFormula={computeFormula}
                  />
                ))}

                {addingL2For === row.id && (
                  <InlineAddRow
                    depth={1}
                    onAdd={(name) => createL2(row.id, name)}
                    onCancel={() => setAddingL2For(null)}
                  />
                )}
              </>
            )}
          </Fragment>
        ))}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div className="flex-none border-t border-gray-100 px-4 py-2 flex items-center gap-3">
        {sourceBoardId ? (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 text-[13px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Agregar desde fuente
          </button>
        ) : (
          <InlineAddButton onAdd={(name) => createL1(name)} />
        )}
      </div>

      {/* ── ProductPicker modal ───────────────────────────────────────────────── */}
      {showPicker && sourceBoardId && (
        <ProductPicker
          sourceBoardId={sourceBoardId}
          onSelect={({ name, id }) => {
            createL1(name, id)
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ─── SubItemRow ───────────────────────────────────────────────────────────────

function SubItemRow({
  row,
  depth,
  isExpanded,
  displayCols,
  formulaCols,
  editTarget,
  onToggleExpand,
  onStartEdit,
  onCommit,
  onCancel,
  onDelete,
  onAddChild,
  computeFormula,
}: {
  row: SubItemData
  depth: 0 | 1
  isExpanded: boolean
  displayCols: SubItemColumn[]
  formulaCols: SubItemColumn[]
  editTarget: EditTarget
  onToggleExpand: () => void
  onStartEdit: (f: string) => void
  onCommit: (f: string, v: unknown) => void
  onCancel: () => void
  onDelete: () => void
  onAddChild: () => void
  computeFormula: (col: SubItemColumn, row: SubItemData) => number | null
}) {
  const isEditing = (f: string) =>
    editTarget?.id === row.id && editTarget.field === f

  const indent = depth === 1 ? 'pl-5' : ''

  return (
    <div
      className={`flex items-center gap-2 px-4 py-1 hover:bg-gray-50 group border-b border-gray-50 ${indent}`}
    >
      {/* Chevron */}
      <div className="w-5 flex-none flex items-center justify-center">
        {depth === 0 && (
          <button
            onClick={onToggleExpand}
            className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="stroke-current"
            >
              <path
                d={
                  isExpanded
                    ? 'M2 4l4 4 4-4'
                    : 'M4 2l4 4-4 4'
                }
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {depth === 1 && (
          <span className="text-gray-300 text-[10px]">└</span>
        )}
      </div>

      {/* SID */}
      <div className="w-16 flex-none text-[12px] text-gray-400 font-mono">
        {row.sid}
      </div>

      {/* Name */}
      <div className="w-40 flex-none">
        <EditableCell
          value={row.name}
          isEditing={isEditing('name')}
          kind="text"
          onStartEdit={() => onStartEdit('name')}
          onCommit={(v) => onCommit('name', v)}
          onCancel={onCancel}
        />
      </div>

      {/* Display columns */}
      {displayCols.map((col) => {
        const val = row.values.find((v) => v.column_id === col.id)
        return (
          <div key={col.id} className="w-24 flex-none text-right">
            <EditableCell
              value={
                col.kind === 'number'
                  ? val?.value_number ?? ''
                  : val?.value_text ?? ''
              }
              isEditing={isEditing(col.id)}
              kind={col.kind === 'number' ? 'number' : 'text'}
              onStartEdit={() => onStartEdit(col.id)}
              onCommit={(v) => onCommit(col.id, v)}
              onCancel={onCancel}
              align="right"
            />
          </div>
        )
      })}

      {/* Formula columns (readonly) */}
      {formulaCols.map((col) => {
        const result = computeFormula(col, row)
        return (
          <div
            key={col.id}
            className="w-24 flex-none text-right text-[13px] text-gray-700 font-medium"
          >
            {result !== null
              ? result.toLocaleString('es-MX', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })
              : '—'}
          </div>
        )
      })}

      {/* Actions */}
      <div className="w-7 flex-none flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {depth === 0 && (
          <button
            onClick={onAddChild}
            title="Agregar sub-item"
            className="text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="stroke-current"
            >
              <path
                d="M6 2v8M2 6h8"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <button
          onClick={onDelete}
          title="Eliminar"
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="stroke-current"
          >
            <path
              d="M2 2l8 8M10 2l-8 8"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  isEditing,
  kind,
  onStartEdit,
  onCommit,
  onCancel,
  align = 'left',
}: {
  value: string | number
  isEditing: boolean
  kind: 'text' | 'number'
  onStartEdit: () => void
  onCommit: (v: string | number) => void
  onCancel: () => void
  align?: 'left' | 'right'
}) {
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
        onBlur={(e) =>
          onCommit(kind === 'number' ? Number(e.target.value) : e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter')
            onCommit(
              kind === 'number'
                ? Number(e.currentTarget.value)
                : e.currentTarget.value
            )
          if (e.key === 'Escape') onCancel()
        }}
      />
    )
  }

  const display =
    value === '' || (value === 0 && kind === 'text') ? '' : value
  const isEmpty = display === ''

  return (
    <div
      onClick={onStartEdit}
      className={`text-[13px] px-1 py-0.5 rounded cursor-text hover:bg-gray-100 transition-colors truncate ${
        align === 'right' ? 'text-right' : ''
      } ${isEmpty ? 'text-gray-400' : 'text-gray-800'}`}
    >
      {isEmpty ? '—' : display}
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
  onAdd: (name: string) => void
  onCancel: () => void
}) {
  const indent = depth === 1 ? 'pl-10' : 'pl-7'

  return (
    <div
      className={`flex items-center gap-2 px-4 py-1 border-b border-gray-50 ${indent}`}
    >
      <input
        autoFocus
        placeholder="Nombre..."
        className="flex-1 text-[13px] border border-indigo-400 rounded px-2 py-0.5 outline-none"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            onAdd(e.currentTarget.value.trim())
          }
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={(e) => {
          if (e.currentTarget.value.trim())
            onAdd(e.currentTarget.value.trim())
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
      onAdd={(name) => {
        onAdd(name)
        setAdding(false)
      }}
      onCancel={() => setAdding(false)}
    />
  )
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function patchTree(
  rows: SubItemData[],
  id: string,
  patch: Partial<SubItemData>
): SubItemData[] {
  return rows.map((r) => {
    if (r.id === id) return { ...r, ...patch }
    if (r.children)
      return { ...r, children: patchTree(r.children, id, patch) }
    return r
  })
}
