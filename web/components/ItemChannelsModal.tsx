'use client'

import { useEffect } from 'react'
import { ItemChannels } from './ItemChannels'

type WorkspaceUser = {
  id: string
  sid: number
  name: string | null
  phone: string | null
}

type Props = {
  itemId:         string
  itemName?:      string
  workspaceUsers: WorkspaceUser[]
  onClose:        () => void
}

export function ItemChannelsModal({ itemId, itemName, workspaceUsers, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-6 bg-[color-mix(in_oklab,var(--ink)_40%,transparent)] backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1100px] h-[calc(100vh-48px)] max-h-[800px] bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-none">
          <div className="flex items-center gap-2 min-w-0">
            <ChatIcon />
            <span className="text-[13px] font-semibold text-[var(--ink)] truncate">
              Canales{itemName ? ` · ${itemName}` : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-sm flex items-center justify-center text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
            title="Cerrar (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ItemChannels itemId={itemId} workspaceUsers={workspaceUsers} />
        </div>
      </div>
    </div>
  )
}

function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--brand)]">
      <path d="M2.5 4c0-.8.7-1.5 1.5-1.5h8c.8 0 1.5.7 1.5 1.5v6c0 .8-.7 1.5-1.5 1.5H7l-3 2.5v-2.5H4c-.8 0-1.5-.7-1.5-1.5V4z" />
    </svg>
  )
}
