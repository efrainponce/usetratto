'use client'

import { useState, useMemo, useRef, useCallback, Fragment, type ReactNode } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
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
  loading?:             boolean
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
  loading,
}: Props) {
  const [sorting,     setSorting]     = useState<SortingState>([])
  const [selection,   setSelection]   = useState<RowSelectionState>({})
  const [editingCell, setEditingCell] = useState<EditingCell>(null)

  // Sticky left offsets
  const stickyLefts = useMemo(() => {
    const map: Record<string, number> = { __expand: 0 }
    let offset = EXPAND_W
    for (const col of columns) {
      if (col.sticky) {
        map[col.key] = offset
        offset += col.width ?? DEFAULT_WIDTHS[col.kind]
      }
    }
    return map
  }, [columns])

  const handleCommit = useCallback((rowId: string, colKey: string, value: CellValue) => {
    onCellChange(rowId, colKey, value)
    setEditingCell(null)
  }, [onCellChange])

  const handleNavigate = useCallback((rowId: string, colKey: string, dir: NavDirection) => {
    const colIdx = columns.findIndex(c => c.key === colKey)
    const rowIdx = rows.findIndex(r => r.id === rowId)
    let nextRow = rowIdx
    let nextCol = colIdx
    if (dir === 'down' || dir === 'enter')  nextRow = Math.min(rowIdx + 1, rows.length - 1)
    else if (dir === 'up')                  nextRow = Math.max(rowIdx - 1, 0)
    else if (dir === 'tab')                 nextCol = Math.min(colIdx + 1, columns.length - 1)
    else if (dir === 'shifttab')            nextCol = Math.max(colIdx - 1, 0)
    const targetRow = rows[nextRow]
    const targetCol = columns[nextCol]
    if (targetRow && targetCol && targetCol.editable !== false) {
      setEditingCell({ rowId: targetRow.id, colKey: targetCol.key })
    } else {
      setEditingCell(null)
    }
  }, [columns, rows])

  const tanstackCols = useMemo(() => {
    const helper = createColumnHelper<Row>()

    // > chevron — expand sub-items inline
    const expandCol = helper.display({
      id:            '__expand',
      size:          EXPAND_W,
      enableSorting: false,
      header:        () => null,
      cell: ({ row }) => {
        const count  = row.original.subItemsCount ?? 0
        const isOpen = expandedSubItemId === row.original.id
        return (
          <button
            onClick={e => { e.stopPropagation(); onExpandSubItems?.(row.original.id) }}
            title={count > 0 ? `${count} sub-item${count !== 1 ? 's' : ''}` : 'Sub-items'}
            className={`w-full h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isOpen ? 'text-indigo-500' : 'text-gray-300 hover:text-gray-500'
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
        header:        col.label,
        size:          col.width ?? DEFAULT_WIDTHS[col.kind],
        enableSorting: col.sortable !== false,
        cell: ({ row }) => (
          <ColumnCell
            column={col}
            value={row.original.cells[col.key] ?? null}
            isEditing={editingCell?.rowId === row.original.id && editingCell?.colKey === col.key}
            rowId={row.original.id}
            onStartEdit={() => setEditingCell({ rowId: row.original.id, colKey: col.key })}
            onCommit={value => handleCommit(row.original.id, col.key, value)}
            onCancel={() => setEditingCell(null)}
            onNavigate={dir => handleNavigate(row.original.id, col.key, dir)}
          />
        ),
      })
    )

    // → open item detail
    const openCol = helper.display({
      id:            '__open',
      size:          OPEN_W,
      enableSorting: false,
      header:        () => null,
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); onOpenItem?.(row.original.id) }}
          title="Abrir detalle"
          className="w-full h-full flex items-center justify-center text-gray-200 hover:text-indigo-500 transition-colors opacity-0 group-hover/row:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
            <path d="M2 7h10M7 2l5 5-5 5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ),
    })

    return [expandCol, ...dataCols, openCol]
  }, [columns, editingCell, expandedSubItemId, handleCommit, handleNavigate, onExpandSubItems, onOpenItem])

  const table = useReactTable({
    data:                 rows,
    columns:              tanstackCols,
    state:                { sorting, rowSelection: selection },
    getRowId:             row => row.id,
    onSortingChange:      setSorting,
    onRowSelectionChange: setSelection,
    getCoreRowModel:      getCoreRowModel(),
    getSortedRowModel:    getSortedRowModel(),
  })

  const { rows: tableRows } = table.getRowModel()
  const headers              = table.getHeaderGroups()[0]?.headers ?? []
  const totalWidth           = headers.reduce((s, h) => s + h.getSize(), 0)
  const selectedIds          = Object.keys(selection).filter(k => selection[k])
  const selectedCount        = selectedIds.length

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
        <div className="flex items-center gap-4 px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-[12px] text-indigo-700 flex-none">
          <span className="font-medium">
            {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
          </span>
          {onBulkDelete && (
            <button
              className="text-red-500 hover:text-red-700 font-medium"
              onClick={() => { onBulkDelete(selectedIds); setSelection({}) }}
            >
              Eliminar
            </button>
          )}
          <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelection({})}>
            Deseleccionar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table
          className="border-collapse"
          style={{ width: Math.max(totalWidth, 1), tableLayout: 'fixed' }}
        >
          <colgroup>
            {headers.map(h => <col key={h.id} style={{ width: h.getSize() }} />)}
          </colgroup>

          {/* Header */}
          <thead className="sticky top-0 z-20 bg-white border-b border-gray-200">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} style={{ height: ROW_HEIGHT }}>
                {hg.headers.map(header => {
                  const isSticky = header.id in stickyLefts
                  return (
                    <th
                      key={header.id}
                      className={[
                        'text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide',
                        'border-r border-gray-100 select-none px-2 group/th',
                        isSticky ? 'z-30' : '',
                        header.column.getCanSort() ? 'cursor-pointer hover:bg-gray-50' : '',
                      ].join(' ')}
                      style={{
                        width:    header.getSize(),
                        position: isSticky ? 'sticky' : undefined,
                        left:     isSticky ? stickyLefts[header.id] : undefined,
                        background: isSticky ? 'white' : undefined,
                        boxShadow: header.id === lastStickyId(columns)
                          ? '2px 0 4px rgba(0,0,0,0.04)' : undefined,
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
                            className="opacity-0 group-hover/th:opacity-100 shrink-0 text-[14px] leading-none text-gray-400 hover:text-indigo-500 transition-opacity px-0.5"
                            title="Configurar columna"
                          >⋯</button>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          {/* Body — no virtualizer, rows with inline expansion */}
          <tbody>
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="py-16 text-center text-[13px] text-gray-400">
                  Sin registros
                </td>
              </tr>
            )}

            {tableRows.map(row => (
              <Fragment key={row.id}>
                {/* Main row */}
                <tr
                  className="group/row border-b border-gray-100 transition-colors hover:bg-gray-50"
                  style={{ height: ROW_HEIGHT }}
                >
                  {row.getVisibleCells().map(cell => {
                    const isSticky = cell.column.id in stickyLefts
                    return (
                      <td
                        key={cell.id}
                        className="border-r border-gray-100 overflow-hidden p-0"
                        style={{
                          width:    cell.column.getSize(),
                          height:   ROW_HEIGHT,
                          position: isSticky ? 'sticky' : undefined,
                          left:     isSticky ? stickyLefts[cell.column.id] : undefined,
                          background: isSticky ? 'white' : undefined,
                          boxShadow: cell.column.id === lastStickyId(columns)
                            ? '2px 0 4px rgba(0,0,0,0.04)' : undefined,
                          zIndex: isSticky ? 10 : undefined,
                        }}
                      >
                        <div className="w-full h-full flex items-center overflow-hidden">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    )
                  })}
                </tr>

                {/* Expansion row (inline sub-items) */}
                {expandedSubItemId === row.original.id && renderRowExpansion && (
                  <tr className="border-b border-indigo-100">
                    <td colSpan={headers.length} className="p-0 bg-indigo-50/30">
                      {renderRowExpansion(row.original.id)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
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
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-none">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function SortDesc() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-none">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}
