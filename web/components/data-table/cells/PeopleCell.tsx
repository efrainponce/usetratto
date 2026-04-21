'use client'

import { useEffect, useRef, useState } from 'react'
import { useDisclosure } from '../../../hooks/useDisclosure'
import { useClickOutside } from '../../../hooks/useClickOutside'
import type { CellProps, SelectOption } from '../types'

export function PeopleCell({ value, isEditing, column, onStartEdit, onCommit, onCancel, settings }: CellProps & { settings?: { display?: 'read_only' } }) {
  const { isOpen: open, open: openDropdown, close: closeDropdown } = useDisclosure(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options: SelectOption[] = column.settings.options ?? []
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (isEditing) { openDropdown(); setSearch(''); setTimeout(() => searchRef.current?.focus(), 30) }
    else closeDropdown()
  }, [isEditing, openDropdown, closeDropdown])

  useClickOutside(containerRef, () => {
    if (open) closeDropdown()
  })

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  const isReadOnly = settings?.display === 'read_only'

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div className="flex items-center gap-1.5 w-full h-full px-2.5 py-1.5 cursor-default" onClick={isReadOnly ? undefined : onStartEdit}>
        {selected ? (
          <>
            <Avatar name={selected.label} />
            <span className="text-[13px] text-[var(--ink)] truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-[13px] text-[var(--ink-3)]">—</span>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-52 bg-[var(--bg)] border border-[var(--border)] rounded-sm shadow-lg z-50 py-1">
          <div className="px-2 py-1 border-b border-[var(--border)]">
            <input
              ref={searchRef}
              className="w-full text-[12px] outline-none text-[var(--ink)] placeholder:text-[var(--ink-4)] bg-[var(--surface)]"
              placeholder="Buscar persona..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); closeDropdown() }
                if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); onCommit(filtered[0].value); closeDropdown() }
              }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--ink-3)] hover:bg-[var(--surface-2)]" onClick={() => { onCommit(null); closeDropdown() }}>
              Sin asignar
            </button>
            {filtered.map(opt => (
              <button key={opt.value} className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-2)] flex items-center gap-2" onClick={() => { onCommit(opt.value); closeDropdown() }}>
                <Avatar name={opt.label} />
                <span className="text-[12px] text-[var(--ink)]">{opt.label}</span>
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
