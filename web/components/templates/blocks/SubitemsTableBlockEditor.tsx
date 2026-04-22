'use client'

import React from 'react'
import type { SubitemsTableBlock, BoardColumnMeta } from '@/lib/document-blocks'

interface SubitemsTableBlockEditorProps {
  block: SubitemsTableBlock
  onChange: (patch: Partial<SubitemsTableBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

type ColConfig = NonNullable<SubitemsTableBlock['column_configs']>[number]

function configFor(block: SubitemsTableBlock, col_key: string): ColConfig {
  return block.column_configs?.find(c => c.col_key === col_key) ?? { col_key }
}

const WIDTH_OPTIONS: Array<{ value: ColConfig['width']; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'sm',   label: 'S' },
  { value: 'md',   label: 'M' },
  { value: 'lg',   label: 'L' },
]

const ALIGN_OPTIONS: Array<{ value: ColConfig['align']; label: string }> = [
  { value: 'auto',  label: 'Auto' },
  { value: 'left',  label: 'Izq' },
  { value: 'right', label: 'Der' },
]

export function SubitemsTableBlockEditor({
  block,
  onChange,
  subItemColumns,
}: SubitemsTableBlockEditorProps) {
  const columns = block.columns ?? []
  const numericColumns = subItemColumns.filter(c => c.kind === 'number')
  const imageColumns = subItemColumns.filter(c => c.kind === 'file')

  const available = subItemColumns.filter(c => !columns.includes(c.col_key))

  function toggleColumn(col_key: string) {
    if (columns.includes(col_key)) {
      onChange({
        columns:        columns.filter(c => c !== col_key),
        column_configs: (block.column_configs ?? []).filter(c => c.col_key !== col_key),
      })
    } else {
      onChange({ columns: [...columns, col_key] })
    }
  }

  function moveColumn(col_key: string, dir: -1 | 1) {
    const idx = columns.indexOf(col_key)
    if (idx < 0) return
    const next = [...columns]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange({ columns: next })
  }

  function setConfig(col_key: string, patch: Partial<ColConfig>) {
    const existing = block.column_configs ?? []
    const idx = existing.findIndex(c => c.col_key === col_key)
    if (idx >= 0) {
      const next = [...existing]
      next[idx] = { ...next[idx], ...patch }
      onChange({ column_configs: next })
    } else {
      onChange({ column_configs: [...existing, { col_key, ...patch }] })
    }
  }

  function toggleTotalColumn(col_key: string) {
    const list = block.total_col_keys ?? []
    onChange({
      total_col_keys: list.includes(col_key)
        ? list.filter(c => c !== col_key)
        : [...list, col_key],
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Thumbnail */}
      <div className="flex flex-col gap-2">
        <span className="label-caps text-[var(--ink-4)]">Miniatura</span>
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)]">
          <input
            type="checkbox"
            checked={!!block.show_thumbnail}
            onChange={e => onChange({ show_thumbnail: e.target.checked })}
            className="w-3.5 h-3.5 accent-[var(--brand)]"
          />
          Mostrar miniatura al inicio de cada fila
        </label>
        {block.show_thumbnail && imageColumns.length > 0 && (
          <select
            value={block.thumbnail_col_key ?? ''}
            onChange={e => onChange({ thumbnail_col_key: e.target.value || undefined })}
            className="px-2 py-1 text-[12px] text-[var(--ink-2)] bg-[var(--surface)] border border-[var(--border)] rounded-sm outline-none"
          >
            <option value="">Auto-generada (patrón diagonal)</option>
            {imageColumns.map(c => <option key={c.col_key} value={c.col_key}>Imagen de columna: {c.name}</option>)}
          </select>
        )}
      </div>

      {/* Columnas ordenadas con reorder + width + align */}
      <div className="flex flex-col gap-2">
        <span className="label-caps text-[var(--ink-4)]">Columnas</span>

        {columns.length === 0 && (
          <div className="text-[11.5px] text-[var(--ink-4)] italic">Sin columnas — agrega abajo</div>
        )}

        {columns.map((col_key, idx) => {
          const col = subItemColumns.find(c => c.col_key === col_key)
          const cfg = configFor(block, col_key)
          return (
            <div key={col_key} className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
              <div className="flex flex-col">
                <button
                  onClick={() => moveColumn(col_key, -1)}
                  disabled={idx === 0}
                  title="Mover arriba"
                  className="px-1 text-[10px] text-[var(--ink-4)] hover:text-[var(--brand)] disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                >▲</button>
                <button
                  onClick={() => moveColumn(col_key, 1)}
                  disabled={idx === columns.length - 1}
                  title="Mover abajo"
                  className="px-1 text-[10px] text-[var(--ink-4)] hover:text-[var(--brand)] disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                >▼</button>
              </div>
              <span className="flex-1 text-[12.5px] text-[var(--ink)] truncate">{col?.name ?? col_key}</span>

              <div className="inline-flex border border-[var(--border)] rounded-sm overflow-hidden">
                {WIDTH_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig(col_key, { width: opt.value })}
                    className={[
                      'px-1.5 py-0.5 text-[10.5px] border-r border-[var(--border)] last:border-r-0',
                      (cfg.width ?? 'auto') === opt.value ? 'bg-[var(--brand)] text-[var(--brand-ink)]' : 'text-[var(--ink-3)] hover:bg-[var(--surface-2)]',
                    ].join(' ')}
                    title={`Ancho ${opt.label}`}
                  >{opt.label}</button>
                ))}
              </div>

              <div className="inline-flex border border-[var(--border)] rounded-sm overflow-hidden">
                {ALIGN_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig(col_key, { align: opt.value })}
                    className={[
                      'px-1.5 py-0.5 text-[10.5px] border-r border-[var(--border)] last:border-r-0',
                      (cfg.align ?? 'auto') === opt.value ? 'bg-[var(--brand)] text-[var(--brand-ink)]' : 'text-[var(--ink-3)] hover:bg-[var(--surface-2)]',
                    ].join(' ')}
                    title={`Alineación ${opt.label}`}
                  >{opt.label}</button>
                ))}
              </div>

              <button
                onClick={() => toggleColumn(col_key)}
                className="text-[12px] text-[var(--ink-4)] hover:text-[var(--stage-lost)] px-1"
                title="Quitar columna"
              >×</button>
            </div>
          )
        })}

        {available.length > 0 && (
          <div className="pt-1">
            <span className="text-[10.5px] text-[var(--ink-4)] uppercase tracking-wide">Agregar:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {available.map(col => (
                <button
                  key={col.col_key}
                  onClick={() => toggleColumn(col.col_key)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11.5px] text-[var(--ink-2)] bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--brand-soft)] rounded-sm"
                >
                  + {col.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)]">
          <input
            type="checkbox"
            checked={!!block.show_totals}
            onChange={e => onChange({ show_totals: e.target.checked })}
            className="w-3.5 h-3.5 accent-[var(--brand)]"
          />
          Mostrar fila de totales al final
        </label>
        {block.show_totals && (
          <div className="flex flex-col gap-1 pl-5">
            <span className="text-[11px] text-[var(--ink-4)]">Columnas a sumar:</span>
            {numericColumns.map(col => (
              <label key={col.col_key} className="flex items-center gap-2 text-[12px] text-[var(--ink-2)]">
                <input
                  type="checkbox"
                  checked={!!block.total_col_keys?.includes(col.col_key)}
                  onChange={() => toggleTotalColumn(col.col_key)}
                  className="w-3.5 h-3.5 accent-[var(--brand)]"
                />
                {col.name}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
