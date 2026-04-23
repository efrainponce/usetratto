'use client'

import type {
  ColumnDef,
  DateBucket,
} from '@/components/data-table/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  columns: ColumnDef[]
  groupBy: string | null
  groupBucket?: DateBucket
  onChange: (groupBy: string | null, bucket?: DateBucket) => void
  onClose: () => void
}

// Groupable column kinds
const GROUPABLE_KINDS = new Set([
  'select',
  'multiselect',
  'people',
  'date',
  'boolean',
  'relation',
])

// ─── Component ────────────────────────────────────────────────────────────────

export function GroupPanel({ columns, groupBy, groupBucket, onChange, onClose }: Props) {
  // Get groupable columns (includes primary_stage columns with kind=select)
  const groupableColumns = columns.filter(col => {
    const isGroupableKind = GROUPABLE_KINDS.has(col.kind)
    const isPrimaryStage = col.settings?.role === 'primary_stage'
    return isGroupableKind || isPrimaryStage
  })

  // Check if currently selected column is a date
  const selectedColumn = groupBy ? groupableColumns.find(c => c.key === groupBy) : null
  const isSelectedDate = selectedColumn?.kind === 'date'

  // ── Handle grouping selection ──────────────────────────────────────────────

  function handleSelectGroup(colKey: string | null) {
    if (colKey === null) {
      // No grouping
      onChange(null)
      onClose()
      return
    }

    const col = groupableColumns.find(c => c.key === colKey)
    if (!col) return

    // If date column, show date bucket selector; otherwise close after selection
    if (col.kind === 'date') {
      onChange(colKey, groupBucket ?? 'day')
      // Don't close yet — let user select bucket
    } else {
      onChange(colKey)
      onClose()
    }
  }

  // ── Handle date bucket selection ───────────────────────────────────────────

  function handleSelectBucket(bucket: DateBucket) {
    if (groupBy) {
      onChange(groupBy, bucket)
      onClose()
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="absolute top-full left-0 mt-1 w-[260px] bg-[var(--bg)] border border-[var(--border)] rounded-sm shadow-lg z-30 p-3"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink)] mb-3 pb-2 border-b border-[var(--border)]">
        Agrupar
      </div>

      {/* Group option list */}
      {!isSelectedDate ? (
        <div className="space-y-1">
          {/* No grouping option */}
          <label className="flex items-center gap-2 p-2 rounded-sm hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
            <input
              type="radio"
              name="group-by"
              checked={groupBy === null}
              onChange={() => handleSelectGroup(null)}
              className="w-4 h-4"
            />
            <span className="text-[12px] text-[var(--ink)]">Sin agrupación</span>
          </label>

          {/* Groupable columns */}
          {groupableColumns.map(col => (
            <label
              key={col.key}
              className="flex items-center gap-2 p-2 rounded-sm hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
            >
              <input
                type="radio"
                name="group-by"
                checked={groupBy === col.key}
                onChange={() => handleSelectGroup(col.key)}
                className="w-4 h-4"
              />
              <span className="text-[12px] text-[var(--ink)]">{col.label}</span>
            </label>
          ))}
        </div>
      ) : (
        /* Date bucket selector */
        <div>
          {/* Back button to column list */}
          <button
            onClick={() => handleSelectGroup(null)}
            className="w-full text-left text-[11px] text-[var(--ink-3)] hover:text-[var(--brand)] mb-2 pb-2 border-b border-[var(--border)]"
          >
            ← Cambiar columna
          </button>

          <div className="text-[11px] font-semibold text-[var(--ink-3)] mb-2">
            Agrupar por:
          </div>

          <div className="space-y-1">
            <button
              onClick={() => handleSelectBucket('day')}
              className={`w-full text-left text-[12px] px-2 py-1.5 rounded-sm transition-colors ${
                groupBucket === 'day'
                  ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                  : 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border)]'
              }`}
            >
              Día
            </button>
            <button
              onClick={() => handleSelectBucket('week')}
              className={`w-full text-left text-[12px] px-2 py-1.5 rounded-sm transition-colors ${
                groupBucket === 'week'
                  ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                  : 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border)]'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => handleSelectBucket('month')}
              className={`w-full text-left text-[12px] px-2 py-1.5 rounded-sm transition-colors ${
                groupBucket === 'month'
                  ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                  : 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border)]'
              }`}
            >
              Mes
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end pt-3 mt-3 border-t border-[var(--border)]">
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
