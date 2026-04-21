'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { BoardColumnMeta } from '@/lib/document-blocks'

export interface SlashMenuProps {
  columns: BoardColumnMeta[]
  onSelect: (colKey: string) => void
  onClose: () => void
  triggerRef?: React.RefObject<HTMLElement>
}

export function SlashMenu({ columns, onSelect, onClose, triggerRef }: SlashMenuProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const filtered = columns.filter((col) => col.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleSelect = (colKey: string) => {
    onSelect(colKey)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && filtered.length > 0) {
      handleSelect(filtered[selectedIndex % filtered.length].col_key)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(filtered.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1))
    }
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg p-2 max-h-64 overflow-y-auto w-64"
    >
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Buscar columna..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value)
          setSelectedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-sm"
      />
      {filtered.length === 0 ? (
        <div className="px-2 py-2 text-sm text-gray-500">No columns found</div>
      ) : (
        <ul className="space-y-1">
          {filtered.map((col, index) => (
            <li key={col.col_key}>
              <button
                onClick={() => handleSelect(col.col_key)}
                className={`w-full text-left px-2 py-1 rounded text-sm ${
                  index === selectedIndex
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">{col.name}</div>
                <div className="text-xs opacity-70">{col.col_key}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Hook to integrate slash menu with text inputs
export function useSlashMenu(
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  columns: BoardColumnMeta[],
  onInsert: (colKey: string) => void
) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const handleKeyDown = (evt: Event) => {
      const e = evt as KeyboardEvent
      if (e.key === '/') {
        // Detect start of slash command
        setShowMenu(true)
      }
    }

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement
      const { value, selectionStart } = target
      if (selectionStart && value[selectionStart - 1] === '/') {
        setShowMenu(true)
      }
    }

    input.addEventListener('keydown', handleKeyDown)
    input.addEventListener('input', handleInput)

    return () => {
      input.removeEventListener('keydown', handleKeyDown)
      input.removeEventListener('input', handleInput)
    }
  }, [inputRef])

  const handleSelectColumn = (colKey: string) => {
    const input = inputRef.current
    if (!input) return

    const { value, selectionStart } = input
    if (!selectionStart) return

    // Find the position of the slash
    let slashPos = selectionStart - 1
    while (slashPos >= 0 && value[slashPos] !== '/') {
      slashPos--
    }

    if (slashPos >= 0) {
      const before = value.substring(0, slashPos)
      const after = value.substring(selectionStart)
      const newValue = before + `{{${colKey}}}` + after
      input.value = newValue
      input.dispatchEvent(new Event('input', { bubbles: true }))
      setShowMenu(false)
      onInsert(colKey)
    }
  }

  return {
    showMenu,
    menuRef,
    onSelect: handleSelectColumn,
    onClose: () => setShowMenu(false),
  }
}
