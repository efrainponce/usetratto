'use client'

import { useState } from 'react'
import type {
  ColumnDef,
  ViewFilter,
  FilterOperator,
  FilterValue,
} from '@/components/data-table/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  columns: ColumnDef[]
  filters: ViewFilter[]
  onChange: (filters: ViewFilter[]) => void
  onClose: () => void
}

// Operator labels in Spanish
const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'Es igual',
  not_equals: 'No es',
  contains: 'Contiene',
  not_contains: 'No contiene',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  between: 'Entre',
  is_empty: 'Vacío',
  is_not_empty: 'No vacío',
  in: 'Es uno de',
  not_in: 'No es ninguno de',
}

// Operators available per column kind
const OPERATORS_BY_KIND: Record<string, FilterOperator[]> = {
  text: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  email: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  phone: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  url: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  relation: ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'gt', 'lt', 'gte', 'lte', 'between', 'is_empty', 'is_not_empty'],
  date: ['equals', 'not_equals', 'gt', 'lt', 'gte', 'lte', 'between', 'is_empty', 'is_not_empty'],
  select: ['equals', 'not_equals', 'in', 'not_in', 'is_empty', 'is_not_empty'],
  multiselect: ['contains', 'not_contains', 'in', 'not_in', 'is_empty', 'is_not_empty'],
  people: ['equals', 'not_equals', 'in', 'not_in', 'is_empty', 'is_not_empty'],
  boolean: ['equals', 'is_empty', 'is_not_empty'],
}

// Kinds that should not appear in filter column picker
const UNFILTERABLE_KINDS = new Set([
  'button',
  'signature',
  'formula',
  'rollup',
  'image',
  'file',
  'autonumber',
])

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterPanel({ columns, filters, onChange, onClose }: Props) {
  // Filter columns by kind
  const filterableColumns = columns.filter(col => !UNFILTERABLE_KINDS.has(col.kind))

  // ── Render value input based on column kind ────────────────────────────────

  function renderValueInput(
    colDef: ColumnDef,
    operator: FilterOperator,
    value: FilterValue,
    onValueChange: (val: FilterValue) => void
  ) {
    const kind = colDef.kind

    // For between operator, show two inputs
    if (operator === 'between') {
      const [val1, val2] = Array.isArray(value) && value.length === 2
        ? value
        : [null, null]

      if (kind === 'number') {
        const v1 = typeof val1 === 'number' ? val1 : 0
        const v2 = typeof val2 === 'number' ? val2 : 0
        return (
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={v1}
              onChange={e => {
                const num = e.target.value ? Number(e.target.value) : 0
                onValueChange([num, v2])
              }}
              placeholder="Min"
              className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
            />
            <span className="text-[var(--ink-3)]">a</span>
            <input
              type="number"
              value={v2}
              onChange={e => {
                const num = e.target.value ? Number(e.target.value) : 0
                onValueChange([v1, num])
              }}
              placeholder="Max"
              className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
            />
          </div>
        )
      }

      if (kind === 'date') {
        const d1 = typeof val1 === 'string' ? val1 : ''
        const d2 = typeof val2 === 'string' ? val2 : ''
        return (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={d1}
              onChange={e => onValueChange([e.target.value, d2])}
              className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
            />
            <span className="text-[var(--ink-3)]">a</span>
            <input
              type="date"
              value={d2}
              onChange={e => onValueChange([d1, e.target.value])}
              className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
            />
          </div>
        )
      }
    }

    // Skip value input for empty/not-empty operators
    if (operator === 'is_empty' || operator === 'is_not_empty') {
      return null
    }

    // Text-based inputs
    if (kind === 'text' || kind === 'email' || kind === 'phone' || kind === 'relation') {
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onValueChange(e.target.value)}
          placeholder="Valor..."
          className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
        />
      )
    }

    // Number input
    if (kind === 'number') {
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={e => onValueChange(e.target.value ? Number(e.target.value) : null)}
          placeholder="Número..."
          className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
        />
      )
    }

    // Date input
    if (kind === 'date') {
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onValueChange(e.target.value)}
          className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
        />
      )
    }

    // Select dropdown
    if (kind === 'select') {
      const options = colDef.settings?.options ?? []
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={e => onValueChange(e.target.value)}
          className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
        >
          <option value="">Seleccionar...</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    // Multiselect dropdown
    if (kind === 'multiselect') {
      const options = colDef.settings?.options ?? []
      const selectedValues: string[] = Array.isArray(value) && value.every((v: unknown) => typeof v === 'string')
        ? (value as string[])
        : []
      return (
        <select
          multiple
          value={selectedValues}
          onChange={e => {
            const vals = Array.from(e.target.selectedOptions, opt => opt.value)
            onValueChange(vals)
          }}
          className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    // People dropdown
    if (kind === 'people') {
      const options = colDef.settings?.options ?? []
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={e => onValueChange(e.target.value)}
          className="flex-1 text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none"
        >
          <option value="">Seleccionar...</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    // Boolean toggle (yes/no)
    if (kind === 'boolean') {
      const isTrue = value === true
      return (
        <div className="flex gap-2">
          <button
            onClick={() => onValueChange(true)}
            className={`px-3 py-1 text-[11px] font-semibold rounded-sm transition-colors ${
              isTrue
                ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                : 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border)]'
            }`}
          >
            Sí
          </button>
          <button
            onClick={() => onValueChange(false)}
            className={`px-3 py-1 text-[11px] font-semibold rounded-sm transition-colors ${
              !isTrue
                ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                : 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border)]'
            }`}
          >
            No
          </button>
        </div>
      )
    }

    return null
  }

  // ── Render filter row ──────────────────────────────────────────────────────

  function renderFilterRow(index: number, filter: ViewFilter) {
    const column = filterableColumns.find(c => c.key === filter.col_key)
    if (!column) return null

    const operators = OPERATORS_BY_KIND[column.kind] ?? []

    return (
      <div key={index} className="flex gap-2 items-start pb-3 mb-3 border-b border-[var(--border)] last:border-b-0 last:mb-0 last:pb-0">
        {/* Column picker */}
        <select
          value={filter.col_key}
          onChange={e => {
            const newFilters = [...filters]
            newFilters[index].col_key = e.target.value
            // Reset operator to first available
            const newCol = filterableColumns.find(c => c.key === e.target.value)
            if (newCol) {
              newFilters[index].operator = OPERATORS_BY_KIND[newCol.kind]?.[0] ?? 'equals'
              newFilters[index].value = ''
            }
            onChange(newFilters)
          }}
          className="text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none flex-none w-[140px]"
        >
          {filterableColumns.map(col => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>

        {/* Operator picker */}
        <select
          value={filter.operator}
          onChange={e => {
            const newFilters = [...filters]
            newFilters[index].operator = e.target.value as FilterOperator
            onChange(newFilters)
          }}
          className="text-[12px] px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none flex-none w-[110px]"
        >
          {operators.map(op => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>

        {/* Value input */}
        <div className="flex-1 flex items-center gap-2">
          {renderValueInput(column, filter.operator, filter.value, (newVal) => {
            const newFilters = [...filters]
            newFilters[index].value = newVal
            onChange(newFilters)
          })}
        </div>

        {/* Remove button */}
        <button
          onClick={() => onChange(filters.filter((_, i) => i !== index))}
          className="flex-none text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors px-1 py-1"
          title="Eliminar filtro"
        >
          ×
        </button>
      </div>
    )
  }

  // ── Add new filter ─────────────────────────────────────────────────────────

  function addFilter() {
    if (filterableColumns.length === 0) return

    const firstCol = filterableColumns[0]
    const firstOp = OPERATORS_BY_KIND[firstCol.kind]?.[0] ?? 'equals'

    onChange([
      ...filters,
      {
        col_key: firstCol.key,
        operator: firstOp,
        value: '',
      },
    ])
  }

  // ── Clear all filters ──────────────────────────────────────────────────────

  function clearFilters() {
    onChange([])
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="w-[420px] bg-[var(--surface)] border border-[var(--border)] rounded-sm shadow-lg p-3"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink)] mb-3 pb-2 border-b border-[var(--border)]">
        Filtrar
      </div>

      {/* Filter rows */}
      <div className="mb-3">
        {filters.map((filter, idx) => renderFilterRow(idx, filter))}
      </div>

      {/* Add filter button */}
      <button
        onClick={addFilter}
        disabled={filterableColumns.length === 0}
        className="w-full text-[12px] py-1.5 rounded-sm border border-dashed border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 mb-3"
      >
        + Agregar filtro
      </button>

      {/* Footer */}
      <div className="flex gap-2 justify-between pt-3 border-t border-[var(--border)]">
        <button
          onClick={clearFilters}
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
