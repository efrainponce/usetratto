'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellProps } from '../types'

function formatDisplay(val: CellValue, format?: string): string {
  if (val == null || val === '') return ''
  const n = Number(val)
  if (isNaN(n)) return String(val)
  if (format === 'currency') return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (format === 'percent')  return `${n}%`
  if (format === 'decimal')  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toLocaleString('es-MX')
}

type CellValue = string | number | boolean | null | string[]

export function NumberCell({ value, isEditing, column, onStartEdit, onCommit, onCancel, onNavigate }: CellProps) {
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setDraft(value != null ? String(value) : '')
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing, value])

  if (!isEditing) {
    return (
      <span
        className="block w-full px-2 py-1 truncate cursor-default text-[13px] text-gray-800 select-none text-right"
        onDoubleClick={onStartEdit}
      >
        {value != null && value !== '' ? formatDisplay(value, column.settings.format) : <span className="text-gray-300">—</span>}
      </span>
    )
  }

  return (
    <input
      ref={inputRef}
      type="number"
      className="w-full px-2 py-1 text-[13px] text-gray-800 bg-transparent outline-none text-right"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onCommit(draft === '' ? null : Number(draft))}
      onKeyDown={e => {
        if (e.key === 'Enter')          { e.preventDefault(); onCommit(draft === '' ? null : Number(draft)); onNavigate('enter') }
        else if (e.key === 'Tab')       { e.preventDefault(); onCommit(draft === '' ? null : Number(draft)); onNavigate(e.shiftKey ? 'shifttab' : 'tab') }
        else if (e.key === 'Escape')    { e.preventDefault(); onCancel() }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onCommit(draft === '' ? null : Number(draft)); onNavigate('down') }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); onCommit(draft === '' ? null : Number(draft)); onNavigate('up') }
      }}
    />
  )
}
