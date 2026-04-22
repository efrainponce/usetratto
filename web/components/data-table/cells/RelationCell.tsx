'use client'

import { useDisclosure } from '../../../hooks/useDisclosure'
import type { CellProps } from '../types'
import { RelationPicker } from '@/components/RelationPicker'

export function RelationCell({ value, column, onCommit }: CellProps) {
  const { isOpen: showPicker, open: openPicker, close: closePicker } = useDisclosure(false)
  const label = typeof value === 'string' && value ? value : null
  const settings = column.settings as any
  const isRef = !!settings?.ref_source_col_key && !!settings?.ref_field_col_key
  const targetBoardId = settings?.target_board_id as string | undefined

  // Ref cols are read-only: value comes from the mirrored source, edits happen at source
  const canPick = !!targetBoardId && !isRef

  return (
    <>
      <div
        className={`flex items-center gap-1 w-full px-2.5 py-1.5 ${canPick ? 'cursor-pointer hover:bg-[var(--surface-2)]' : 'cursor-default'}`}
        onClick={() => { if (canPick) openPicker() }}
      >
        {label ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--border)] bg-[var(--surface-2)] pl-0.5 pr-1.5 py-0.5 text-[12px] font-medium text-[var(--ink-2)] truncate max-w-full hover:border-[var(--brand-soft)]">
            {isRef && <span className="text-[var(--stage-quote)] text-[10px] leading-none">↪</span>}
            <RelationAvatar name={label} />
            <span className="truncate">{label}</span>
          </span>
        ) : (
          <span className="text-[13px] text-[var(--ink-3)]">{canPick ? 'Elegir…' : '—'}</span>
        )}
      </div>
      {showPicker && canPick && targetBoardId && (
        <RelationPicker
          targetBoardId={targetBoardId}
          onPick={(itemId, _itemName) => {
            onCommit(itemId ?? null)
            closePicker()
          }}
          onClose={() => closePicker()}
        />
      )}
    </>
  )
}

const AVATAR_PALETTE = [
  '#B8461E', '#7A4E2E', '#4A6B4F', '#8B6B1F',
  '#2D5A3D', '#6B4F2E', '#9B3A2A', '#5A6B7E',
]

function RelationAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '·'
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const color = AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
  return (
    <span
      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white flex-none leading-none"
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  )
}
