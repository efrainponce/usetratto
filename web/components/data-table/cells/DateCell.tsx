'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellProps } from '../types'

function toInputValue(val: string | number | boolean | null | string[]): string {
  if (!val || typeof val !== 'string') return ''
  // Accept ISO strings, return YYYY-MM-DD for input[type=date]
  return val.substring(0, 10)
}

function formatDisplay(val: string | number | boolean | null | string[]): string {
  if (!val || typeof val !== 'string') return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function DateCell({ value, isEditing, onStartEdit, onCommit, onCancel, onNavigate }: CellProps) {
  const [draft, setDraft] = useState(toInputValue(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setDraft(toInputValue(value))
      // Slight delay so the input renders before focus
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.showPicker?.() }, 30)
    }
  }, [isEditing, value])

  if (!isEditing) {
    return (
      <span
        className="block w-full px-2 py-1 truncate cursor-default text-[13px] text-gray-800 select-none"
        onDoubleClick={onStartEdit}
      >
        {value ? formatDisplay(value) : <span className="text-gray-300">—</span>}
      </span>
    )
  }

  return (
    <input
      ref={inputRef}
      type="date"
      className="w-full px-2 py-1 text-[13px] text-gray-800 bg-transparent outline-none"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onCommit(draft || null)}
      onKeyDown={e => {
        if (e.key === 'Enter')       { e.preventDefault(); onCommit(draft || null); onNavigate('enter') }
        else if (e.key === 'Tab')    { e.preventDefault(); onCommit(draft || null); onNavigate(e.shiftKey ? 'shifttab' : 'tab') }
        else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      }}
    />
  )
}
