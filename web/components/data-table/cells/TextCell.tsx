'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellProps } from '../types'

export function TextCell({ value, isEditing, onStartEdit, onCommit, onCancel, onNavigate }: CellProps) {
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
        className="block w-full px-2 py-1 truncate cursor-default text-[13px] text-gray-800 select-none"
        onDoubleClick={onStartEdit}
      >
        {value != null && value !== '' ? String(value) : <span className="text-gray-300">—</span>}
      </span>
    )
  }

  return (
    <input
      ref={inputRef}
      className="w-full px-2 py-1 text-[13px] text-gray-800 bg-transparent outline-none"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={e => {
        if (e.key === 'Enter')           { e.preventDefault(); onCommit(draft); onNavigate('enter') }
        else if (e.key === 'Tab')        { e.preventDefault(); onCommit(draft); onNavigate(e.shiftKey ? 'shifttab' : 'tab') }
        else if (e.key === 'Escape')     { e.preventDefault(); onCancel() }
        else if (e.key === 'ArrowDown')  { e.preventDefault(); onCommit(draft); onNavigate('down') }
        else if (e.key === 'ArrowUp')    { e.preventDefault(); onCommit(draft); onNavigate('up') }
      }}
    />
  )
}
