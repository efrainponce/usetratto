'use client'

import { useEffect, useRef, useState } from 'react'
import { useDisclosure } from '../../../hooks/useDisclosure'
import { useClickOutside } from '../../../hooks/useClickOutside'
import type { CellProps, SelectOption } from '../types'

export function SelectCell({ value, isEditing, column, onStartEdit, onCommit, onCancel }: CellProps) {
  const { isOpen: open, open: openDropdown, close: closeDropdown } = useDisclosure(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options: SelectOption[] = column.settings.options ?? []
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (isEditing) {
      openDropdown()
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 30)
    } else {
      closeDropdown()
    }
  }, [isEditing, openDropdown, closeDropdown])

  useClickOutside(containerRef, () => {
    if (open) {
      onCancel()
    }
  })

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Display */}
      <div
        className="flex items-center w-full h-full px-2.5 py-1.5 cursor-default"
        onClick={onStartEdit}
      >
        {selected ? (
          <Badge option={selected} />
        ) : (
          <span className="text-[13px] text-[var(--ink-3)]">—</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-48 bg-[var(--bg)] border border-[var(--border)] rounded-sm shadow-lg z-50 py-1 overflow-hidden">
          <div className="px-2 py-1 border-b border-[var(--border)]">
            <input
              ref={searchRef}
              className="w-full text-[12px] outline-none text-[var(--ink)] placeholder:text-[var(--ink-4)] bg-[var(--surface)]"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); closeDropdown(); onCancel() }
                if (e.key === 'Enter' && filtered.length > 0) {
                  e.preventDefault(); onCommit(filtered[0].value); closeDropdown()
                }
              }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {/* Clear option */}
            <button
              className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--ink-3)] hover:bg-[var(--surface-2)] transition-colors"
              onClick={() => { onCommit(null); closeDropdown() }}
            >
              Sin valor
            </button>
            {filtered.map(opt => (
              <button
                key={opt.value}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2"
                onClick={() => { onCommit(opt.value); closeDropdown() }}
              >
                <Badge option={opt} />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-[var(--ink-3)]">Sin resultados</p>
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
      className="inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-medium text-white"
      style={{ backgroundColor: option.color ?? 'var(--ink)' }}
    >
      {option.label}
    </span>
  )
}
