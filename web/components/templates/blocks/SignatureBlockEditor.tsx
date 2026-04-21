'use client'

import React from 'react'
import type { SignatureBlock, BoardColumnMeta } from '@/lib/document-blocks'

interface SignatureBlockEditorProps {
  block: SignatureBlock
  onChange: (patch: Partial<SignatureBlock>) => void
  onDelete: () => void
  availableColumns: BoardColumnMeta[]
  subItemColumns: BoardColumnMeta[]
}

export function SignatureBlockEditor({
  block,
  onChange,
}: SignatureBlockEditorProps) {
  return (
    <div className="space-y-3">
      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Rol</span>
        <input
          type="text"
          value={block.role}
          onChange={(e) => onChange({ role: e.target.value })}
          placeholder="cliente, gerente, etc."
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <label>
        <span className="block text-xs font-medium text-gray-700 mb-1">Etiqueta personalizada (opcional)</span>
        <input
          type="text"
          value={block.label || ''}
          onChange={(e) => onChange({ label: e.target.value || undefined })}
          placeholder="Firma"
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={block.required || false}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">Requerida</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={block.auto_sign_by_owner || false}
          onChange={(e) => onChange({ auto_sign_by_owner: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">Auto-firmar por propietario</span>
      </label>
    </div>
  )
}
