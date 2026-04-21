'use client'

import { useState, useMemo, useRef, useCallback, useEffect, Fragment, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
  type ColumnSizingState,
} from '@tanstack/react-table'
import type { ColumnDef as ColDef, Row, CellValue, NavDirection } from './types'
import { DEFAULT_WIDTHS } from './types'
import { ColumnCell } from './cells/ColumnCell'

const ROW_HEIGHT = 36
const EXPAND_W   = 32   // > chevron column
const OPEN_W     = 36   // → open item column

type EditingCell = { rowId: string; colKey: string } | null

type Props = {
  columns:              ColDef[]
  rows:                 Row[]
  onCellChange:         (rowId: string, colKey: string, value: CellValue) => void
  onExpandSubItems?:    (rowId: string) => void
  expandedSubItemId?:   string | null
  renderRowExpansion?:  (rowId: string) => ReactNode
  onOpenItem?:          (rowId: string) => void
  onBulkDelete?:        (ids: string[]) => void
  onColumnSettings?:    (colKey: string) => void
  onAddColumn?:         (name: string, kind: string) => Promise<void>
  loading?:             boolean
  storageKey?:          string   // if provided, column widths are persisted to localStorage
}

export function GenericDataTable({
  columns,
  rows,
  onCellChange,
  onExpandSubItems,
  expandedSubItemId,
  renderRowExpansion,
  onOpenItem,
  onBulkDelete,
  onColumnSettings,
  onAddColumn,
  loading,
  storageKey,
}: Props) {
  const [sorting,       setSorting]       = useState<SortingState>([])
  const [selection,     setSelection]     = useState<RowSelectionState>({})
  const [editingCell,   setEditingCell]   = useState<EditingCell>(null)
  const [columnSizing,  setColumnSizing]  = useState<ColumnSizingState>({})
  const [selectedCell,  setSelectedCell]  = useState<{ rowId: string; colKey: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  // Load persisted column widths after hydration (never during SSR to avoid mismatch)
  useEffect(() => {
    if (!storageKey) return
    try {
      const stored = localStorage.getItem(`col-widths:${storageKey}`)
      if (stored) setColumnSizing(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [storageKey])

  // Persist column widths whenever they change
  useEffect(() => {
    if (!storageKey) return
    if (Object.keys(columnSizing).length === 0) return
    localStorage.setItem(`col-widths:${storageKey}`, JSON.stringify(columnSizing))
  }, [columnSizing, storageKey])

  // Drop sizing entries for deleted columns — prevents TanStack "column does not exist" error
  useEffect(() => {
    const validKeys = new Set(columns.map(c => c.key))
    setColumnSizing(prev => {
      const staleKeys = Object.keys(prev).filter(k => !validKeys.has(k))
      if (staleKeys.length === 0) return prev
      const next = { ...prev }
      staleKeys.forEach(k => delete next[k])
      return next
    })
  }, [columns])

  const handleCommit = useCallback((rowId: string, colKey: string, value: CellValue) => {
    onCellChange(rowId, colKey, value)
    setEditingCell(null)
  }, [onCellChange])

  const handleStartEdit = useCallback((rowId: string, colKey: string) => {
    setSelectedCell({ rowId, colKey })
    setEditingCell({ rowId, colKey })
  }, [])

  const handleCancel = useCallback(() => {
    setEditingCell(null)
  }, [])

  const handleNavigate = useCallback((rowId: string, colKey: string, dir: NavDirection) => {
    const colIdx = columns.findIndex(c => c.key === colKey)
    const rowIdx = rows.findIndex(r => r.id === rowId)
    let nextRow = rowIdx
    let nextCol = colIdx
    if (dir === 'down' || dir === 'enter')  nextRow = Math.min(rowIdx + 1, rows.length - 1)
    else if (dir === 'up')                  nextRow = Math.max(rowIdx - 1, 0)
    else if (dir === 'right')               nextCol = Math.min(colIdx + 1, columns.length - 1)
    else if (dir === 'left')                nextCol = Math.max(colIdx - 1, 0)
    else if (dir === 'tab')                 nextCol = Math.min(colIdx + 1, columns.length - 1)
    else if (dir === 'shifttab')            nextCol = Math.max(colIdx - 1, 0)
    const targetRow = rows[Math.max(0, Math.min(nextRow, rows.length - 1))]
    const targetCol = columns[Math.max(0, Math.min(nextCol, columns.length - 1))]
    if (targetRow && targetCol) {
      setSelectedCell({ rowId: targetRow.id, colKey: targetCol.key })
    }
    setEditingCell(null)
    // Return focus to the table container so keyboard events keep working
    setTimeout(() => containerRef.current?.focus(), 0)
  }, [columns, rows])

  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // While editing, let the cell handle keys
    if (editingCell) return
    if (!selectedCell) return

    const { rowId, colKey } = selectedCell
    const rowIdx = rows.findIndex(r => r.id === rowId)
    const colIdx = columns.findIndex(c => c.key === colKey)

    const moveTo = (r: number, c: number) => {
      const tr = rows[Math.max(0, Math.min(r, rows.length - 1))]
      const tc = columns[Math.max(0, Math.min(c, columns.length - 1))]
      if (tr && tc) setSelectedCell({ rowId: tr.id, colKey: tc.key })
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); moveTo(rowIdx - 1, colIdx); break
      case 'ArrowDown':
        e.preventDefault(); moveTo(rowIdx + 1, colIdx); break
      case 'ArrowLeft':
        e.preventDefault(); moveTo(rowIdx, colIdx - 1); break
      case 'ArrowRight':
        e.preventDefault(); moveTo(rowIdx, colIdx + 1); break
      case 'Enter':
      case 'F2': {
        e.preventDefault()
        const col = columns[colIdx]
        if (col && col.editable !== false) {
          setEditingCell({ rowId, colKey })
        }
        break
      }
      case 'Escape':
        e.preventDefault()
        setSelectedCell(null)
        break
      default:
        // Printable character starts editing
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const col = columns[colIdx]
          if (col && col.editable !== false) {
            setEditingCell({ rowId, colKey })
          }
        }
    }
  }, [editingCell, selectedCell, rows, columns])

  const tanstackCols = useMemo(() => {
    const helper = createColumnHelper<Row>()

    // > chevron — expand sub-items inline
    const expandCol = helper.display({
      id:             '__expand',
      size:           EXPAND_W,
      enableSorting:  false,
      enableResizing: false,
      header:         () => null,
      cell: ({ row }) => {
        const count  = row.original.subItemsCount ?? 0
        const isOpen = expandedSubItemId === row.original.id
        return (
          <button
            onClick={e => { e.stopPropagation(); onExpandSubItems?.(row.original.id) }}
            title={count > 0 ? `${count} sub-item${count !== 1 ? 's' : ''}` : 'Sub-items'}
            className={`w-full h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isOpen ? 'text-[var(--brand)]' : 'text-[var(--ink-4)] hover:text-[var(--ink-2)]'
            }`}
          >
            <svg
              width="13" height="13" viewBox="0 0 14 14" fill="none"
              className={`stroke-current transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
            >
              <path d="M5 2l5 5-5 5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {count > 0 && (
              <span className="text-[8px] font-semibold leading-none tabular-nums">{count}</span>
            )}
          </button>
        )
      },
    })

    // data columns
    const dataCols = columns.map(col =>
      helper.accessor(row => row.cells[col.key] ?? null, {
        id:            col.key,
        header: () => (
          <div className="flex items-center gap-0.5">
            <span>{col.label}</span>
            {(col.settings as any)?.ref_source_col_key && (
              <span className="text-amber-500" title={`Reflejo de ${(col.settings as any).ref_source_col_key} → ${(col.settings as any).ref_field_col_key}`}>↪</span>
            )}
          </div>
        ),
        size:          col.width ?? DEFAULT_WIDTHS[col.kind],
        enableSorting: col.sortable !== false,
        cell: ({ row }) => (
          <ColumnCell
            column={col}
            value={row.original.cells[col.key] ?? null}
            row={row.original.cells}
            allColumns={columns}
            isEditing={editingCell?.rowId === row.original.id && editingCell?.colKey === col.key}
            rowId={row.original.id}
            onStartEdit={() => handleStartEdit(row.original.id, col.key)}
            onCommit={value => handleCommit(row.original.id, col.key, value)}
            onCancel={handleCancel}
            onNavigate={dir => handleNavigate(row.original.id, col.key, dir)}
          />
        ),
      })
    )

    // ↗ open item detail
    const openCol = helper.display({
      id:             '__open',
      size:           OPEN_W,
      enableSorting:  false,
      enableResizing: false,
      header: () => (
        <span className="flex items-center justify-center w-full" title="Abrir detalle">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 10L10 2M6 2h4v4" />
          </svg>
        </span>
      ),
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); onOpenItem?.(row.original.id) }}
          title="Abrir detalle"
          className="w-full h-full flex items-center justify-center text-[var(--ink-4)] hover:text-[var(--brand)] transition-colors opacity-0 group-hover/row:opacity-100"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 10L10 2M6 2h4v4" />
          </svg>
        </button>
      ),
    })

    return [expandCol, openCol, ...dataCols]
  }, [columns, editingCell, expandedSubItemId, handleCommit, handleStartEdit, handleCancel, handleNavigate, onExpandSubItems, onOpenItem])

  const table = useReactTable({
    data:                   rows,
    columns:                tanstackCols,
    state:                  { sorting, rowSelection: selection, columnSizing },
    getRowId:               row => row.id,
    onSortingChange:        setSorting,
    onRowSelectionChange:   setSelection,
    onColumnSizingChange:   setColumnSizing,
    getCoreRowModel:        getCoreRowModel(),
    getSortedRowModel:      getSortedRowModel(),
    enableColumnResizing:   true,
    columnResizeMode:       'onChange',
  })

  // Sticky left offsets (now using actual column sizes from table)
  const stickyLefts = useMemo(() => {
    const map: Record<string, number> = { __expand: 0 }
    let offset = EXPAND_W
    for (const col of columns) {
      if (col.sticky) {
        map[col.key] = offset
        offset += table.getColumn(col.key)?.getSize() ?? col.width ?? DEFAULT_WIDTHS[col.kind]
      }
    }
    return map
  }, [columns, columnSizing, table])

  const { rows: tableRows } = table.getRowModel()
  const headers              = table.getHeaderGroups()[0]?.headers ?? []
  const totalWidth           = headers.reduce((s, h) => s + h.getSize(), 0)
  const selectedIds          = Object.keys(selection).filter(k => selection[k])
  const selectedCount        = selectedIds.length

  // Virtual scrolling: only render ~25-30 visible rows
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    measureElement: typeof window !== 'undefined' ? element => element?.getBoundingClientRect().height : undefined,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0
  const paddingBottom = virtualRows.length > 0
    ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
    : 0

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-gray-400">
        Cargando…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Selection bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface)_92%)] border-b border-[var(--brand-soft)] text-[12px] text-[var(--brand-deep)] flex-none">
          <span className="font-medium">
            {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
          </span>
          {onBulkDelete && (
            <button
              className="text-[var(--stage-lost)] hover:text-[var(--stage-lost)] font-medium"
              onClick={() => { onBulkDelete(selectedIds); setSelection({}) }}
            >
              Eliminar
            </button>
          )}
          <button className="text-[var(--ink-3)] hover:text-[var(--ink)]" onClick={() => setSelection({})}>
            Deseleccionar
          </button>
        </div>
      )}

      {/* Table */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto outline-none bg-[var(--bg)]"
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        onClick={e => {
          // Focus container when clicking anywhere in the table
          containerRef.current?.focus()
        }}
      >
        <table
          className="border-collapse"
          style={{ width: Math.max(totalWidth, 1), tableLayout: 'fixed' }}
        >
          <colgroup>
            {headers.map(h => <col key={h.id} style={{ width: h.getSize() }} />)}
          </colgroup>

          {/* Header */}
          <thead className="sticky top-0 z-20 bg-[var(--bg)] border-b border-[var(--border)]">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} style={{ height: ROW_HEIGHT }}>
                {hg.headers.map(header => {
                  const isSticky = header.id in stickyLefts
                  return (
                    <th
                      key={header.id}
                      className={[
                        'text-left text-[10.5px] font-semibold text-[var(--ink-4)] uppercase tracking-[0.08em]',
                        'border-r border-[var(--border)] select-none px-2.5 py-2 group/th overflow-visible',
                        isSticky ? 'z-30' : '',
                        header.column.getCanSort() ? 'cursor-pointer hover:bg-[var(--surface-2)]' : '',
                      ].join(' ')}
                      style={{
                        width:    header.getSize(),
                        position: isSticky ? 'sticky' : 'relative',
                        left:     isSticky ? stickyLefts[header.id] : undefined,
                        background: isSticky ? 'var(--bg)' : undefined,
                        boxShadow: header.id === lastStickyId(columns)
                          ? '2px 0 4px rgba(0,0,0,0.04)' : undefined,
                        overflow: 'visible',
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1 overflow-hidden">
                        <span className="flex-1 truncate min-w-0">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {header.column.getIsSorted() === 'asc'  && <SortAsc />}
                        {header.column.getIsSorted() === 'desc' && <SortDesc />}
                        {onColumnSettings && !header.id.startsWith('__') && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onColumnSettings(header.id)
                            }}
                            className="opacity-0 group-hover/th:opacity-100 shrink-0 text-[14px] leading-none text-[var(--ink-4)] hover:text-[var(--brand)] transition-opacity px-0.5"
                            title="Configurar columna"
                          >⋯</button>
                        )}
                      </div>

                      {!header.id.startsWith('__') && header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none touch-none z-10 group/resizer"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className={[
                            'h-4 w-px rounded-full transition-colors',
                            header.column.getIsResizing()
                              ? 'bg-[var(--brand)]'
                              : 'bg-[var(--border)] group-hover/resizer:bg-[var(--brand-soft)]',
                          ].join(' ')} />
                        </div>
                      )}
                    </th>
                  )
                })}
                {onAddColumn && (
                  <th className="border-r border-[var(--border)] px-1" style={{ width: 36 }}>
                    <AddColumnButton onAdd={onAddColumn} />
                  </th>
                )}
              </tr>
            ))}
          </thead>

          {/* Body — with virtual scrolling, rows with inline expansion */}
          <tbody ref={tbodyRef}>
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="py-16 text-center text-[13px] text-[var(--ink-3)]">
                  Sin registros
                </td>
              </tr>
            )}

            {tableRows.length > 0 && (
              <>
                {/* Padding for rows before virtual window */}
                {paddingTop > 0 && (
                  <tr style={{ height: paddingTop }}>
                    <td />
                  </tr>
                )}

                {/* Virtual rows */}
                {virtualRows.map(virtualRow => {
                  const row = tableRows[virtualRow.index]
                  if (!row) return null

                  return (
                    <Fragment key={row.id}>
                      {/* Main row */}
                      <tr
                        className="group/row border-b border-[var(--border)] transition-colors hover:bg-[color-mix(in_oklab,var(--brand)_3%,var(--surface)_97%)]"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {row.getVisibleCells().map(cell => {
                          const isSticky = cell.column.id in stickyLefts
                          const isThisSelected = !cell.column.id.startsWith('__') &&
                            selectedCell?.rowId === row.original.id &&
                            selectedCell?.colKey === cell.column.id
                          return (
                            <td
                              key={cell.id}
                              className="border-r border-[var(--border)] p-0 cursor-default"
                              onClick={() => {
                                if (!cell.column.id.startsWith('__')) {
                                  setSelectedCell({ rowId: row.original.id, colKey: cell.column.id })
                                  containerRef.current?.focus()
                                }
                              }}
                              style={{
                                width:    cell.column.getSize(),
                                height:   ROW_HEIGHT,
                                position: isSticky ? 'sticky' : undefined,
                                left:     isSticky ? stickyLefts[cell.column.id] : undefined,
                                background: isSticky
                                  ? (isThisSelected ? 'color-mix(in oklab, var(--brand) 8%, var(--surface) 92%)' : 'var(--bg)')
                                  : (isThisSelected ? 'color-mix(in oklab, var(--brand) 8%, var(--surface) 92%)' : undefined),
                                boxShadow: isThisSelected
                                  ? 'inset 0 0 0 2px var(--brand)'
                                  : (cell.column.id === lastStickyId(columns) ? '2px 0 4px rgba(0,0,0,0.04)' : undefined),
                                zIndex: isSticky ? 10 : undefined,
                              }}
                            >
                              <div className="w-full h-full flex items-center">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </div>
                            </td>
                          )
                        })}
                      </tr>

                      {/* Expansion row (inline sub-items) */}
                      {expandedSubItemId === row.original.id && renderRowExpansion && (
                        <tr className="border-b border-[var(--border)]">
                          <td colSpan={headers.length} className="p-0 bg-[color-mix(in_oklab,var(--brand)_3%,var(--surface)_97%)]">
                            {renderRowExpansion(row.original.id)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}

                {/* Padding for rows after virtual window */}
                {paddingBottom > 0 && (
                  <tr style={{ height: paddingBottom }}>
                    <td />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function lastStickyId(columns: ColDef[]): string {
  const keys = columns.filter(c => c.sticky).map(c => c.key)
  return keys[keys.length - 1] ?? '__expand'
}

function SortAsc() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-none text-[var(--ink-4)]">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function SortDesc() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-none text-[var(--ink-4)]">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}

const ADD_COL_KINDS = [
  { value: 'text',        label: 'Texto' },
  { value: 'number',      label: 'Número' },
  { value: 'date',        label: 'Fecha' },
  { value: 'select',      label: 'Selección simple' },
  { value: 'multiselect', label: 'Selección múltiple' },
  { value: 'people',      label: 'Persona' },
  { value: 'boolean',     label: 'Checkbox' },
  { value: 'phone',       label: 'Teléfono' },
  { value: 'email',       label: 'Email' },
  { value: 'file',        label: 'Archivo(s)' },
  { value: 'button',      label: 'Botón' },
  { value: 'signature',   label: 'Firma' },
  { value: 'formula',     label: 'Fórmula' },
]

function AddColumnButton({ onAdd }: { onAdd: (name: string, kind: string) => Promise<void> }) {
  const [open,   setOpen]   = useState(false)
  const [name,   setName]   = useState('')
  const [kind,   setKind]   = useState('text')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [pos,    setPos]    = useState<{ top: number; left: number } | null>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const PANEL_W = 224 // w-56
      const left = (r.left + PANEL_W > window.innerWidth - 8)
        ? Math.max(8, r.right - PANEL_W)
        : r.left
      setPos({ top: r.bottom + 4, left })
    }
    setOpen(true)
    setName('')
    setKind('text')
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  const handleClose = () => { setOpen(false); setSaving(false); setError(null) }

  const handleSubmit = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await onAdd(name.trim(), kind)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear columna')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current   && !btnRef.current.contains(e.target as Node)
      ) handleClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown',   onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center justify-center w-full h-full text-[var(--ink-4)] hover:text-[var(--brand)] hover:bg-[var(--surface-2)] rounded-sm transition-colors text-[16px] leading-none"
        title="Agregar columna"
      >+</button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-[var(--bg)] border border-[var(--border)] rounded-sm shadow-lg p-3 w-56"
          onMouseDown={e => e.stopPropagation()}
        >
          <p className="text-[11px] font-semibold text-[var(--ink-4)] uppercase tracking-wide mb-2">Nueva columna</p>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); handleSubmit() }
              if (e.key === 'Escape') { e.preventDefault(); handleClose() }
            }}
            placeholder="Nombre de columna"
            className="w-full text-[13px] border border-[var(--border)] rounded-sm px-2 py-1.5 outline-none focus:border-[var(--brand-soft)] focus:ring-[var(--brand-soft)] mb-2 bg-[var(--surface)] text-[var(--ink)]"
          />
          <div className="border border-[var(--border)] rounded-sm overflow-y-auto mb-3" style={{ maxHeight: 180 }}>
            {ADD_COL_KINDS.map(k => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={`w-full text-left text-[13px] px-2 py-1.5 transition-colors ${
                  kind === k.value
                    ? 'bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface)_92%)] text-[var(--brand-deep)] font-medium'
                    : 'text-[var(--ink)] hover:bg-[var(--surface-2)]'
                }`}
              >{k.label}</button>
            ))}
          </div>
          {error && (
            <p className="text-[11px] text-[var(--stage-lost)] mb-2">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 text-[12px] px-2 py-1.5 border border-[var(--border)] rounded-sm text-[var(--ink-2)] hover:bg-[var(--surface-2)] transition-colors"
            >Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || saving}
              className="flex-1 text-[12px] px-2 py-1.5 bg-[var(--brand)] text-[var(--brand-ink)] rounded-sm hover:bg-[var(--brand-deep)] disabled:opacity-50 transition-colors"
            >{saving ? '...' : 'Crear'}</button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
