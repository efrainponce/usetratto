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
  const isStage = column.settings.role === 'primary_stage' || column.key === 'stage'

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
        className="flex items-center w-full h-full px-2.5 py-2 cursor-default"
        onClick={onStartEdit}
      >
        {selected ? (
          isStage ? (
            <StageProgress options={options} selectedValue={value} />
          ) : (
            <Badge option={selected} />
          )
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

function StageProgress({ options, selectedValue }: { options: SelectOption[]; selectedValue: any }) {
  const idx = options.findIndex(o => o.value === selectedValue)
  const selected = idx >= 0 ? options[idx] : null
  const isLost = selected && (selected.label.toLowerCase().includes('perd') || selected.label.toLowerCase().includes('lost'))
  const N = Math.max(options.length, 1)

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {options.map((opt, i) => {
          const done = selected && !isLost && i <= idx
          const bg = isLost ? 'var(--stage-lost)' : (done ? (opt.color ?? 'var(--stage-new)') : 'var(--border)')
          return <span key={opt.value} className="h-[3px] rounded-[2px]" style={{ background: bg }} />
        })}
      </div>
      {selected && (
        <span
          className="font-[family-name:var(--font-geist-mono)] text-[10.5px] uppercase tracking-[0.04em] font-semibold"
          style={{ color: isLost ? 'var(--stage-lost)' : (selected.color ?? 'var(--ink-2)') }}
        >
          {selected.label}
        </span>
      )}
      {!selected && (
        <span className="text-[var(--ink-4)] text-[11px]">—</span>
      )}
    </div>
  )
}
