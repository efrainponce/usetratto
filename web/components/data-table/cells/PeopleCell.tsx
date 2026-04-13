'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellProps, SelectOption } from '../types'

export function PeopleCell({ value, isEditing, column, onStartEdit, onCommit, onCancel }: CellProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options: SelectOption[] = column.settings.options ?? []
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (isEditing) { setOpen(true); setSearch(''); setTimeout(() => searchRef.current?.focus(), 30) }
    else setOpen(false)
  }, [isEditing])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onCancel()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, onCancel])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div className="flex items-center gap-1.5 w-full h-full px-2 py-1 cursor-default" onDoubleClick={onStartEdit}>
        {selected ? (
          <>
            <Avatar name={selected.label} />
            <span className="text-[13px] text-gray-700 truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-[13px] text-gray-300">—</span>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-2 py-1 border-b border-gray-100">
            <input
              ref={searchRef}
              className="w-full text-[12px] outline-none text-gray-700 placeholder:text-gray-300"
              placeholder="Buscar persona..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); onCancel() }
                if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); onCommit(filtered[0].value); setOpen(false) }
              }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button className="w-full text-left px-3 py-1.5 text-[12px] text-gray-400 hover:bg-gray-50" onClick={() => { onCommit(null); setOpen(false) }}>
              Sin asignar
            </button>
            {filtered.map(opt => (
              <button key={opt.value} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2" onClick={() => { onCommit(opt.value); setOpen(false) }}>
                <Avatar name={opt.label} />
                <span className="text-[12px] text-gray-700">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  // Deterministic color from name
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-none"
      style={{ backgroundColor: `hsl(${hue}, 55%, 50%)` }}
    >
      {initials}
    </div>
  )
}
