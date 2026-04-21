'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellProps } from '../types'

export function PhoneCell({ value, isEditing, onStartEdit, onCommit, onCancel, onNavigate }: CellProps) {
  const [draft, setDraft] = useState(value as string ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setDraft(value as string ?? '')
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing, value])

  if (!isEditing) {
    return (
      <span
        className="block w-full px-2.5 py-1.5 truncate cursor-default text-[13px] text-[var(--ink)] select-none font-[family-name:var(--font-geist-mono)] tabular-nums"
        onDoubleClick={onStartEdit}
      >
        {value ? String(value) : <span className="text-[var(--ink-3)]">—</span>}
      </span>
    )
  }

  return (
    <input
      ref={inputRef}
      type="tel"
      className="w-full px-2.5 py-1.5 text-[13px] text-[var(--ink)] bg-[var(--surface)] border border-[var(--brand-soft)] rounded-sm outline-none focus:border-[var(--brand)] font-[family-name:var(--font-geist-mono)]"
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
