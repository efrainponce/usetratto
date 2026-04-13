'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellProps, SelectOption } from '../types'

export function MultiSelectCell({ value, isEditing, column, onStartEdit, onCommit, onCancel }: CellProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options: SelectOption[] = column.settings.options ?? []
  const selected: string[] = Array.isArray(value) ? value : (value ? [String(value)] : [])

  useEffect(() => {
    if (isEditing) { setOpen(true); setSearch(''); setTimeout(() => searchRef.current?.focus(), 30) }
    else setOpen(false)
  }, [isEditing])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCommit(selected.length ? selected : null)
        onCancel()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, onCancel, onCommit, selected])

  function toggle(val: string) {
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)
      : [...selected, val]
    onCommit(next.length ? next : null)
  }

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selectedOptions = options.filter(o => selected.includes(o.value))

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div
        className="flex items-center gap-1 w-full h-full px-2 py-1 cursor-default flex-wrap overflow-hidden"
        onDoubleClick={onStartEdit}
      >
        {selectedOptions.length > 0
          ? selectedOptions.slice(0, 2).map(o => (
              <span
                key={o.value}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white flex-none"
                style={{ backgroundColor: o.color ?? '#94a3b8' }}
              >
                {o.label}
              </span>
            ))
          : <span className="text-[13px] text-gray-300">—</span>
        }
        {selectedOptions.length > 2 && (
          <span className="text-[11px] text-gray-400">+{selectedOptions.length - 2}</span>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-2 py-1 border-b border-gray-100">
            <input
              ref={searchRef}
              className="w-full text-[12px] outline-none text-gray-700 placeholder:text-gray-300"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onCancel() } }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt.value}
                className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                onClick={() => toggle(opt.value)}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-none ${selected.includes(opt.value) ? 'bg-gray-800 border-gray-800' : 'border-gray-300'}`}>
                  {selected.includes(opt.value) && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium text-white"
                  style={{ backgroundColor: opt.color ?? '#94a3b8' }}
                >
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
