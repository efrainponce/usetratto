'use client'

import type {
  ColumnDef,
  ViewSort,
} from '@/components/data-table/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  columns: ColumnDef[]
  sorts: ViewSort[]
  onChange: (sorts: ViewSort[]) => void
  onClose: () => void
}

// Kinds that should not appear in sort column picker
const UNSORTABLE_KINDS = new Set([
  'button',
  'signature',
  'file',
  'image',
])

// ─── Component ────────────────────────────────────────────────────────────────

export function SortPanel({ columns, sorts, onChange, onClose }: Props) {
  // Filter columns by kind
  const sortableColumns = columns.filter(col => !UNSORTABLE_KINDS.has(col.kind))

  // ── Move sort up (swap with previous) ──────────────────────────────────────

  function moveSortUp(index: number) {
    if (index === 0) return
    const newSorts = [...sorts]
    ;[newSorts[index], newSorts[index - 1]] = [newSorts[index - 1], newSorts[index]]
    onChange(newSorts)
  }

  // ── Move sort down (swap with next) ────────────────────────────────────────

  function moveSortDown(index: number) {
    if (index >= sorts.length - 1) return
    const newSorts = [...sorts]
    ;[newSorts[index], newSorts[index + 1]] = [newSorts[index + 1], newSorts[index]]
    onChange(newSorts)
  }

  // ── Remove sort ────────────────────────────────────────────────────────────

  function removeSort(index: number) {
    onChange(sorts.filter((_, i) => i !== index))
  }

  // ── Render sort row ────────────────────────────────────────────────────────

  function renderSortRow(index: number, sort: ViewSort) {
    const column = sortableColumns.find(c => c.key === sort.col_key)
    if (!column) return null

    const isFirst = index === 0
    const isLast = index === sorts.length - 1

    return (
      <div key={index} className="flex gap-2 items-center pb-3 mb-3 border-b border-[var(--border)] last:border-b-0 last:mb-0 last:pb-0">
        {/* Priority number */}
        <span className="flex-none text-[11px] font-semibold text-[var(--ink-3)] w-6">
          {index + 1}.
        </span>

        {/* Up/Down buttons */}
        <div className="flex flex-col gap-0.5 flex-none">
          <button
            onClick={() => moveSortUp(index)}
            disabled={isFirst}
            title="Mover arriba"
            className="text-[10px] px-1 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={() => moveSortDown(index)}
            disabled={isLast}
            title="Mover abajo"
            className="text-[10px] px-1 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors disabled:opacity-30"
          >
            ↓
          </button>
        </div>

        {/* Column picker */}
        <select
          value={sort.col_key}
          onChange={e => {
            const newSorts = [...sorts]
            newSorts[index].col_key = e.target.value
            onChange(newSorts)
          }}
          className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
        >
          {sortableColumns.map(col => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>

        {/* Direction toggle buttons */}
        <div className="flex gap-1 flex-none">
          <button
            onClick={() => {
              const newSorts = [...sorts]
              newSorts[index].dir = 'asc'
              onChange(newSorts)
            }}
            className={`px-2 py-1 text-[11px] font-semibold rounded-sm transition-colors ${
              sort.dir === 'asc'
                ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                : 'bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--ink)]'
            }`}
          >
            ASC
          </button>
          <button
            onClick={() => {
              const newSorts = [...sorts]
              newSorts[index].dir = 'desc'
              onChange(newSorts)
            }}
            className={`px-2 py-1 text-[11px] font-semibold rounded-sm transition-colors ${
              sort.dir === 'desc'
                ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                : 'bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--ink)]'
            }`}
          >
            DESC
          </button>
        </div>

        {/* Remove button */}
        <button
          onClick={() => removeSort(index)}
          className="flex-none text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors px-1 py-1"
          title="Eliminar orden"
        >
          ×
        </button>
      </div>
    )
  }

  // ── Add new sort ───────────────────────────────────────────────────────────

  function addSort() {
    if (sortableColumns.length === 0) return

    const firstCol = sortableColumns[0]
    onChange([
      ...sorts,
      {
        col_key: firstCol.key,
        dir: 'asc',
      },
    ])
  }

  // ── Clear all sorts ────────────────────────────────────────────────────────

  function clearSorts() {
    onChange([])
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="w-[380px] bg-[var(--surface)] border border-[var(--border)] rounded-sm shadow-lg p-3"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink)] mb-3 pb-2 border-b border-[var(--border)]">
        Ordenar
      </div>

      {/* Sort rows */}
      <div className="mb-3">
        {sorts.map((sort, idx) => renderSortRow(idx, sort))}
      </div>

      {/* Add sort button */}
      <button
        onClick={addSort}
        disabled={sortableColumns.length === 0}
        className="w-full text-[12px] py-1.5 rounded-sm border border-dashed border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 mb-3"
      >
        + Agregar orden
      </button>

      {/* Footer */}
      <div className="flex gap-2 justify-between pt-3 border-t border-[var(--border)]">
        <button
          onClick={clearSorts}
          className="text-[12px] px-3 py-1 rounded-sm text-[var(--ink-3)] hover:text-[var(--brand)] transition-colors"
        >
          Limpiar
        </button>
        <button
          onClick={onClose}
          className="text-[12px] px-3 py-1 rounded-sm bg-[var(--brand)] text-[var(--brand-ink)] hover:opacity-90 transition-opacity"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
