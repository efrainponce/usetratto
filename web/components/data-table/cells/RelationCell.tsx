'use client'

import { useState } from 'react'
import type { CellProps } from '../types'
import { RelationPicker } from '@/components/RelationPicker'

export function RelationCell({ value, column, onCommit }: CellProps) {
  const [showPicker, setShowPicker] = useState(false)
  const label = typeof value === 'string' && value ? value : null
  const settings = column.settings as any
  const isRef = !!settings?.ref_source_col_key && !!settings?.ref_field_col_key
  const targetBoardId = settings?.target_board_id as string | undefined

  // Ref cols are read-only: value comes from the mirrored source, edits happen at source
  const canPick = !!targetBoardId && !isRef

  return (
    <>
      <div
        className={`flex items-center gap-1 w-full px-2 py-1 ${canPick ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
        onClick={() => { if (canPick) setShowPicker(true) }}
      >
        {label ? (
          <span className="text-[13px] text-gray-700 truncate">{label}</span>
        ) : (
          <span className="text-[13px] text-gray-300">{canPick ? 'Elegir…' : '—'}</span>
        )}
      </div>
      {showPicker && canPick && targetBoardId && (
        <RelationPicker
          targetBoardId={targetBoardId}
          onPick={(itemId, _itemName) => {
            onCommit(itemId ?? null)
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
