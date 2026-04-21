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
          <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--ink-2)] truncate max-w-full hover:border-[var(--brand-soft)]">
            {isRef && <span className="text-[var(--stage-quote)] text-[10px] leading-none">↪</span>}
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
