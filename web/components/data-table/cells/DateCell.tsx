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

function formatRelative(val: string | number | boolean | null | string[]): string {
  if (!val || typeof val !== 'string') return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '—'
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'hace unos segundos'
  if (diffMins < 60) return `hace ${diffMins} min`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export function DateCell({ value, isEditing, onStartEdit, onCommit, onCancel, onNavigate, settings }: CellProps & { settings?: { display?: 'relative' | 'absolute'; read_only?: boolean } }) {
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
    const displayValue = settings?.display === 'relative' ? formatRelative(value) : (value ? formatDisplay(value) : '—')
    const isReadOnly = settings?.read_only === true
    return (
      <span
        className="block w-full px-2 py-1 truncate cursor-default text-[13px] text-gray-800 select-none"
        onDoubleClick={isReadOnly ? undefined : onStartEdit}
      >
        {displayValue === '—' ? <span className="text-gray-300">—</span> : displayValue}
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
