'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ColumnDef as ColDef, Row, CellValue, NavDirection } from './types'
import { DEFAULT_WIDTHS } from './types'
import { ColumnCell } from './cells/ColumnCell'

const ROW_HEIGHT    = 36
const CHECKBOX_W    = 40 // width of the __select column

type EditingCell = { rowId: string; colKey: string } | null

type Props = {
  columns:         ColDef[]
  rows:            Row[]
  onCellChange:    (rowId: string, colKey: string, value: CellValue) => void
  onRowClick?:     (rowId: string) => void
  onBulkDelete?:   (ids: string[]) => void
  loading?:        boolean
}

export function GenericDataTable({
  columns,
  rows,
  onCellChange,
  onRowClick,
  onBulkDelete,
  loading,
}: Props) {
  const [sorting, setSorting]         = useState<SortingState>([])
  const [selection, setSelection]     = useState<RowSelectionState>({})
  const [editingCell, setEditingCell] = useState<EditingCell>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // Compute sticky left offsets
  const stickyLefts = useMemo(() => {
    const map: Record<string, number> = { __select: 0 }
    let offset = CHECKBOX_W
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

    const selectCol = helper.display({
      id:           '__select',
      size:         CHECKBOX_W,
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
        />
      ),
    })

    const dataCols = columns.map(col =>
      helper.accessor(row => row.cells[col.key] ?? null, {
        id:           col.key,
        header:       col.label,
        size:         col.width ?? DEFAULT_WIDTHS[col.kind],
        enableSorting: col.sortable !== false,
        cell: ({ row }) => (
          <ColumnCell
            column={col}
            value={row.original.cells[col.key] ?? null}
            isEditing={
              editingCell?.rowId === row.original.id &&
              editingCell?.colKey === col.key
            }
            rowId={row.original.id}
            onStartEdit={() => setEditingCell({ rowId: row.original.id, colKey: col.key })}
            onCommit={value => handleCommit(row.original.id, col.key, value)}
            onCancel={() => setEditingCell(null)}
            onNavigate={dir => handleNavigate(row.original.id, col.key, dir)}
          />
        ),
      })
    )

    return [selectCol, ...dataCols]
  }, [columns, editingCell, handleCommit, handleNavigate])

  const table = useReactTable({
    data:               rows,
    columns:            tanstackCols,
    state:              { sorting, rowSelection: selection },
    getRowId:           row => row.id,
    onSortingChange:    setSorting,
    onRowSelectionChange: setSelection,
    getCoreRowModel:    getCoreRowModel(),
    getSortedRowModel:  getSortedRowModel(),
  })

  const { rows: tableRows } = table.getRowModel()

  const virtualizer = useVirtualizer({
    count:           tableRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize:    () => ROW_HEIGHT,
    overscan:        12,
  })

  const virtualRows   = virtualizer.getVirtualItems()
  const totalHeight   = virtualizer.getTotalSize()
  const paddingTop    = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0

  const headers       = table.getHeaderGroups()[0]?.headers ?? []
  const totalWidth    = headers.reduce((s, h) => s + h.getSize(), 0)
  const selectedIds   = Object.keys(selection).filter(k => selection[k])
  const selectedCount = selectedIds.length

  // ── Loading state ──────────────────────────────────────────────────────────
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
              onClick={() => {
                onBulkDelete(selectedIds)
                setSelection({})
              }}
            >
              Eliminar
            </button>
          )}
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={() => setSelection({})}
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* Scrollable table container */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <table
          className="border-collapse"
          style={{ width: Math.max(totalWidth, 1), tableLayout: 'fixed' }}
        >
          <colgroup>
            {headers.map(h => (
              <col key={h.id} style={{ width: h.getSize() }} />
            ))}
          </colgroup>

          {/* ── Header ────────────────────────────────────────────────────── */}
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
                        'border-r border-gray-100 select-none px-2',
                        isSticky ? 'z-30' : '',
                        header.column.getCanSort() ? 'cursor-pointer hover:bg-gray-50' : '',
                      ].join(' ')}
                      style={{
                        width:    header.getSize(),
                        position: isSticky ? 'sticky' : undefined,
                        left:     isSticky ? stickyLefts[header.id] : undefined,
                        background: isSticky ? 'white' : undefined,
                        boxShadow: header.id === lastStickyId(columns) ? '2px 0 4px rgba(0,0,0,0.04)' : undefined,
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1 truncate">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'  && <SortAsc />}
                        {header.column.getIsSorted() === 'desc' && <SortDesc />}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td colSpan={headers.length} style={{ height: paddingTop }} />
              </tr>
            )}

            {virtualRows.map(vr => {
              const row = tableRows[vr.index]
              return (
                <tr
                  key={row.id}
                  className={[
                    'border-b border-gray-100 transition-colors',
                    row.getIsSelected() ? 'bg-indigo-50' : 'hover:bg-gray-50 cursor-pointer',
                  ].join(' ')}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onRowClick?.(row.original.id)}
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
                          background: row.getIsSelected() ? '#eef2ff' : isSticky ? 'white' : undefined,
                          boxShadow: cell.column.id === lastStickyId(columns) ? '2px 0 4px rgba(0,0,0,0.04)' : undefined,
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
              )
            })}

            {paddingBottom > 0 && (
              <tr>
                <td colSpan={headers.length} style={{ height: paddingBottom }} />
              </tr>
            )}

            {tableRows.length === 0 && (
              <tr>
                <td
                  colSpan={headers.length}
                  className="py-16 text-center text-[13px] text-gray-400"
                >
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Returns the col key of the last sticky data column (for shadow)
function lastStickyId(columns: ColDef[]): string {
  const stickyKeys = columns.filter(c => c.sticky).map(c => c.key)
  return stickyKeys[stickyKeys.length - 1] ?? '__select'
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
