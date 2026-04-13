'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellProps, SelectOption } from '../types'

export function SelectCell({ value, isEditing, column, onStartEdit, onCommit, onCancel }: CellProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options: SelectOption[] = column.settings.options ?? []
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (isEditing) {
      setOpen(true)
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 30)
    } else {
      setOpen(false)
    }
  }, [isEditing])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, onCancel])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Display */}
      <div
        className="flex items-center w-full h-full px-2 py-1 cursor-default"
        onClick={onStartEdit}
      >
        {selected ? (
          <Badge option={selected} />
        ) : (
          <span className="text-[13px] text-gray-300">—</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          <div className="px-2 py-1 border-b border-gray-100">
            <input
              ref={searchRef}
              className="w-full text-[12px] outline-none text-gray-700 placeholder:text-gray-300"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); onCancel() }
                if (e.key === 'Enter' && filtered.length > 0) {
                  e.preventDefault(); onCommit(filtered[0].value); setOpen(false)
                }
              }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {/* Clear option */}
            <button
              className="w-full text-left px-3 py-1.5 text-[12px] text-gray-400 hover:bg-gray-50 transition-colors"
              onClick={() => { onCommit(null); setOpen(false) }}
            >
              Sin valor
            </button>
            {filtered.map(opt => (
              <button
                key={opt.value}
                className="w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors flex items-center gap-2"
                onClick={() => { onCommit(opt.value); setOpen(false) }}
              >
                <Badge option={opt} />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-gray-300">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Badge({ option }: { option: SelectOption }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
      style={{ backgroundColor: option.color ?? '#94a3b8' }}
    >
      {option.label}
    </span>
  )
}
