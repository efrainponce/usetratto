'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellProps } from '../types'

export function EmailCell({ value, isEditing, onStartEdit, onCommit, onCancel, onNavigate }: CellProps) {
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
      <div className="flex items-center w-full px-2.5 py-1.5" onDoubleClick={onStartEdit}>
        {value ? (
          <a
            href={`mailto:${value}`}
            className="text-[13px] text-[var(--brand)] hover:underline truncate"
            onClick={e => e.stopPropagation()}
          >
            {String(value)}
          </a>
        ) : (
          <span className="text-[13px] text-[var(--ink-3)] cursor-default select-none">—</span>
        )}
      </div>
    )
  }

  return (
    <input
      ref={inputRef}
      type="email"
      className="w-full px-2.5 py-1.5 text-[13px] text-[var(--ink)] bg-[var(--surface)] border border-[var(--brand-soft)] rounded-sm outline-none focus:border-[var(--brand)]"
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
