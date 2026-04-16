'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { useDisclosure } from '../hooks/useDisclosure'
import type { SubItemColumn } from '@/lib/boards'
import { ProductPicker } from './ProductPicker'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  onCountChange?: (count: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InlineSubItems({
  itemId,
  boardId,
  subItemColumns,
  sourceBoardId,
  onCountChange,
}: Props) {
  const [rows, setRows] = useState<SubItemData[]>([])
  const [columns, setColumns] = useState<SubItemColumn[]>(subItemColumns)
  const [loading, setLoading] = useState(true)
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const { isOpen: showPicker, open: openPicker, close: closePicker } = useDisclosure(false)
  const { isOpen: showAddForm, open: openAddForm, close: closeAddForm } = useDisclosure(false)
  const [addingL2For, setAddingL2For] = useState<string | null>(null)
  const [addName, setAddName] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  const onCountChangeRef = useRef(onCountChange)
  useEffect(() => {
    onCountChangeRef.current = onCountChange
  })

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

  useEffect(() => {
    onCountChangeRef.current?.(rows.length)
  }, [rows.length])

  useEffect(() => {
    if (showAddForm) setTimeout(() => addInputRef.current?.focus(), 50)
  }, [showAddForm])

  // ── Compute formula (client-side) ───────────────────────────────────────────

  function computeFormula(
    col: SubItemColumn,
    row: SubItemData
  ): number | null {
    if (col.kind !== 'formula') return null

    const s = col.settings as {
      formula: 'multiply' | 'add' | 'subtract' | 'percent' | 'sum_children'
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

    const valsByKey: Record<string, number | null> = {}
    for (const v of row.values) {
      valsByKey[v.col_key] = v.value_number
    }

    const a = valsByKey[s.col_a]
    const b = valsByKey[s.col_b]
    if (a == null || b == null) return null

    switch (s.formula) {
      case 'multiply': return a * b
      case 'add':      return a + b
      case 'subtract': return a - b
      case 'percent':  return (a * b) / 100
      default:         return null
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  const submitAdd = useCallback(
    async (name: string, source_item_id?: string) => {
      if (!name.trim()) return

      setAddName('')
      closeAddForm()

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

        if (!res.ok) { console.error('[InlineSubItems] create failed:', res.status); return }
        const created = (await res.json()) as SubItemData
        if (!created?.id) return

        setRows((prev) => [...prev, { ...created, children: [] }])
      } catch (e) {
        console.error('Failed to create sub-item:', e)
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
        if (!res.ok) { console.error('[InlineSubItems] createL2 failed:', res.status); return }
        const created = (await res.json()) as SubItemData
        if (!created?.id) return
        setRows(prev =>
          prev.map(r =>
            r.id === parentId
              ? { ...r, children: [...(r.children ?? []), { ...created, children: [] }] }
              : r
          )
        )
        setExpandedL1(s => new Set([...s, parentId]))
        setAddingL2For(null)
      } catch (e) {
        console.error('[InlineSubItems] createL2 error:', e)
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
        // Reload to get fresh state
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

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="px-8 py-3 text-[12px] text-gray-400">Cargando...</div>
  }

  const displayCols = columns.filter((c) => !c.is_hidden && c.kind !== 'formula')
  const formulaCols = columns.filter((c) => !c.is_hidden && c.kind === 'formula')
  const sourceLabel = sourceBoardId ? 'Importar' : 'Sub-items'

  return (
    <div className="py-2">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pb-1.5">
        <span className="text-[12px] font-semibold text-gray-600">Sub-items</span>
        {!showAddForm && (
          <button
            onClick={() => sourceBoardId ? openPicker() : openAddForm()}
            className="flex items-center gap-1 text-[12px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <span className="text-[15px] leading-none">+</span> Agregar
          </button>
        )}
      </div>

      {/* Table */}
      {rows.length > 0 && (
        <table className="w-full border-collapse mb-1 px-8" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 32 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 120 }} />
            {displayCols.map((c) => (
              <col key={c.id} style={{ width: 80 }} />
            ))}
            {formulaCols.map((c) => (
              <col key={c.id} style={{ width: 80 }} />
            ))}
            <col style={{ width: 28 }} />
          </colgroup>
          <thead>
            <tr className="text-[10px] text-gray-400 uppercase tracking-wide">
              <th />
              <th className="text-left pb-1 font-semibold pl-8">#</th>
              <th className="text-left pb-1 font-semibold">Nombre</th>
              {displayCols.map((c) => (
                <th key={c.id} className="text-left pb-1 font-semibold text-right">
                  {c.name}
                </th>
              ))}
              {formulaCols.map((c) => (
                <th key={c.id} className="text-left pb-1 font-semibold text-right">
                  {c.name}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <SubItemRow
                  row={row}
                  depth={0}
                  isExpanded={expandedL1.has(row.id)}
                  displayCols={displayCols}
                  formulaCols={formulaCols}
                  editTarget={editTarget}
                  onToggleExpand={() =>
                    setExpandedL1((s) => {
                      const n = new Set(s)
                      n.has(row.id) ? n.delete(row.id) : n.add(row.id)
                      return n
                    })
                  }
                  onStartEdit={(f) => setEditTarget({ id: row.id, field: f })}
                  onCommit={(f, v) => editField(row.id, f, v)}
                  onCancel={() => setEditTarget(null)}
                  onDelete={() => remove(row.id, 0, null)}
                  onAddChild={() => {
                    setExpandedL1(s => new Set([...s, row.id]))
                    setAddingL2For(row.id)
                  }}
                  computeFormula={computeFormula}
                />
                {expandedL1.has(row.id) &&
                  (row.children ?? []).map((child) => (
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
                {expandedL1.has(row.id) && addingL2For === row.id && (
                  <tr>
                    <td />
                    <td />
                    <td colSpan={displayCols.length + formulaCols.length + 1} className="py-0.5 pl-3">
                      <input
                        autoFocus
                        placeholder="Nombre variante..."
                        className="w-full text-[12px] border border-indigo-400 rounded px-2 py-0.5 outline-none"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim())
                            createL2(row.id, e.currentTarget.value.trim())
                          if (e.key === 'Escape') setAddingL2For(null)
                        }}
                        onBlur={e => {
                          if (e.currentTarget.value.trim()) createL2(row.id, e.currentTarget.value.trim())
                          else setAddingL2For(null)
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {rows.length === 0 && !showAddForm && (
        <p className="px-8 text-[12px] text-gray-400 italic mb-1">Sin sub-items</p>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="px-8">
          <div className="flex items-center gap-2 py-1">
            <input
              ref={addInputRef}
              type="text"
              placeholder="Nombre..."
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="flex-1 text-[12px] px-2 py-1 rounded border border-indigo-300 outline-none focus:border-indigo-500 bg-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && addName.trim())
                  submitAdd(addName)
                if (e.key === 'Escape') closeAddForm()
              }}
            />
            <button
              onClick={() => closeAddForm()}
              className="flex-none text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="stroke-current"
              >
                <path d="M2 2l8 8M10 2l-8 8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Product picker */}
      {showPicker && sourceBoardId && (
        <ProductPicker
          sourceBoardId={sourceBoardId}
          onSelect={({ name, id }) => {
            submitAdd(name, id)
            closePicker()
          }}
          onClose={() => closePicker()}
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

  return (
    <tr className="group/si hover:bg-white/60 transition-colors">
      {/* Expand */}
      <td className="py-0.5">
        {depth === 0 ? (
          <button
            onClick={onToggleExpand}
            className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className={`stroke-current transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            >
              <path
                d="M3 1.5l3.5 3.5L3 8.5"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <span className="text-gray-300 text-[10px] pl-1">└</span>
        )}
      </td>

      {/* SID */}
      <td className={`py-0.5 text-[11px] text-gray-400 font-mono ${
        depth === 1 ? 'pl-3' : ''
      }`}>
        {row.sid}
      </td>

      {/* Name */}
      <td className="py-0.5">
        <InlineEdit
          value={row.name}
          isEditing={isEditing('name')}
          kind="text"
          onStart={() => onStartEdit('name')}
          onCommit={(v) => onCommit('name', v)}
          onCancel={onCancel}
        />
      </td>

      {/* Display columns */}
      {displayCols.map((col) => {
        const val = row.values.find((v) => v.column_id === col.id)
        return (
          <td key={col.id} className="py-0.5 text-right">
            <InlineEdit
              value={
                col.kind === 'number'
                  ? val?.value_number ?? ''
                  : val?.value_text ?? ''
              }
              isEditing={isEditing(col.id)}
              kind={col.kind === 'number' ? 'number' : 'text'}
              onStart={() => onStartEdit(col.id)}
              onCommit={(v) => onCommit(col.id, v)}
              onCancel={onCancel}
              align="right"
            />
          </td>
        )
      })}

      {/* Formula columns (readonly) */}
      {formulaCols.map((col) => {
        const result = computeFormula(col, row)
        return (
          <td
            key={col.id}
            className="py-0.5 text-right text-[12px] text-gray-700 font-medium"
          >
            {result !== null
              ? result.toLocaleString('es-MX', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })
              : '—'}
          </td>
        )
      })}

      {/* Actions */}
      <td className="py-0.5">
        <div className="flex items-center gap-1 opacity-0 group-hover/si:opacity-100 transition-opacity">
          {depth === 0 && (
            <button
              onClick={onAddChild}
              title="Agregar sub-item"
              className="text-gray-400 hover:text-indigo-500 transition-colors"
            >
              <svg
                width="11"
                height="11"
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
              width="11"
              height="11"
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
      </td>
    </tr>
  )
}

// ─── InlineEdit ───────────────────────────────────────────────────────────────

function InlineEdit({
  value,
  isEditing,
  kind,
  onStart,
  onCommit,
  onCancel,
  align = 'left',
}: {
  value: string | number
  isEditing: boolean
  kind: 'text' | 'number'
  onStart: () => void
  onCommit: (v: string | number) => void
  onCancel: () => void
  align?: 'left' | 'right'
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) ref.current?.select()
  }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={ref}
        autoFocus
        defaultValue={String(value)}
        type={kind === 'number' ? 'number' : 'text'}
        className={`w-full text-[12px] bg-white border border-indigo-400 rounded px-1 py-0 outline-none ${
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

  const empty = value === '' || (value === 0 && kind === 'text')
  return (
    <div
      onClick={onStart}
      className={`text-[12px] px-1 py-0 rounded cursor-text hover:bg-white/80 transition-colors truncate ${
        align === 'right' ? 'text-right' : ''
      } ${empty ? 'text-gray-300' : 'text-gray-800'}`}
    >
      {empty ? '—' : value}
    </div>
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
