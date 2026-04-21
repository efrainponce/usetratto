'use client'

import { useEffect, useRef, useState } from 'react'
import { useDisclosure } from '../../../hooks/useDisclosure'
import { useClickOutside } from '../../../hooks/useClickOutside'
import type { CellProps, SelectOption } from '../types'

export function MultiSelectCell({ value, isEditing, column, onStartEdit, onCommit, onCancel }: CellProps) {
  const { isOpen: open, open: openDropdown, close: closeDropdown } = useDisclosure(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options: SelectOption[] = column.settings.options ?? []
  const selected: string[] = Array.isArray(value) ? value : (value ? [String(value)] : [])

  useEffect(() => {
    if (isEditing) { openDropdown(); setSearch(''); setTimeout(() => searchRef.current?.focus(), 30) }
    else closeDropdown()
  }, [isEditing, openDropdown, closeDropdown])

  useClickOutside(containerRef, () => {
    if (open) {
      onCommit(selected.length ? selected : null)
      onCancel()
    }
  })

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
        className="flex items-center gap-1 w-full h-full px-2.5 py-1.5 cursor-default flex-wrap overflow-hidden"
        onClick={onStartEdit}
      >
        {selectedOptions.length > 0
          ? selectedOptions.slice(0, 2).map(o => (
              <span
                key={o.value}
                className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11.5px] font-medium text-white flex-none"
                style={{ backgroundColor: o.color ?? 'var(--ink)' }}
              >
                {o.label}
              </span>
            ))
          : <span className="text-[13px] text-[var(--ink-3)]">—</span>
        }
        {selectedOptions.length > 2 && (
          <span className="text-[11px] text-[var(--ink-3)]">+{selectedOptions.length - 2}</span>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-52 bg-[var(--bg)] border border-[var(--border)] rounded-sm shadow-lg z-50 py-1">
          <div className="px-2 py-1 border-b border-[var(--border)]">
            <input
              ref={searchRef}
              className="w-full text-[12px] outline-none text-[var(--ink)] placeholder:text-[var(--ink-4)] bg-[var(--surface)]"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); closeDropdown() } }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt.value}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-2)] flex items-center gap-2"
                onClick={() => toggle(opt.value)}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-none ${selected.includes(opt.value) ? 'bg-[var(--brand)] border-[var(--brand)]' : 'border-[var(--border)]'}`}>
                  {selected.includes(opt.value) && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11.5px] font-medium text-white"
                  style={{ backgroundColor: opt.color ?? 'var(--ink)' }}
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
