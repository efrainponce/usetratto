'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SubItemColumn } from './types'

type SourceBoardCol = { id: string; col_key: string; name: string; kind: string }

const COL_KIND_OPTIONS = [
  { value: 'text',      label: 'Texto' },
  { value: 'number',    label: 'Número' },
  { value: 'date',      label: 'Fecha' },
  { value: 'select',    label: 'Select' },
  { value: 'boolean',   label: 'Check' },
  { value: 'formula',   label: 'Fórmula' },
  { value: 'relation',  label: 'Relación' },
  { value: 'signature', label: 'Firma' },
  { value: 'file',      label: 'Archivo' },
  { value: 'image',     label: 'Imagen' },
  { value: 'phone',     label: 'Teléfono' },
  { value: 'email',     label: 'Email' },
  { value: 'url',       label: 'URL' },
]

type Props = {
  boardId:        string
  viewId:         string
  sourceBoardId?: string
  position:       number
  onCreated:      (col: SubItemColumn) => void
  onCancel:       () => void
}

export function AddColumnInline({ boardId, viewId, sourceBoardId, position, onCreated, onCancel }: Props) {
  const [name,          setName]          = useState('')
  const [kind,          setKind]          = useState('text')
  const [sourceColKey,  setSourceColKey]  = useState('')
  const [sourceCols,    setSourceCols]    = useState<SourceBoardCol[]>([])
  const [saving,        setSaving]        = useState(false)
  const [kindPanelPos,  setKindPanelPos]  = useState<{ top: number; left: number } | null>(null)
  const kindBtnRef   = useRef<HTMLButtonElement>(null)
  const kindPanelRef = useRef<HTMLDivElement>(null)

  const currentKindLabel = COL_KIND_OPTIONS.find(o => o.value === kind)?.label ?? kind

  useEffect(() => {
    if (!sourceBoardId) return
    fetch(`/api/boards/${sourceBoardId}/columns`)
      .then(r => r.json())
      .then((data: SourceBoardCol[]) => setSourceCols(Array.isArray(data) ? data : []))
      .catch(() => setSourceCols([]))
  }, [sourceBoardId])

  useEffect(() => {
    if (!kindPanelPos) return
    const onDown = (e: MouseEvent) => {
      if (
        kindPanelRef.current && !kindPanelRef.current.contains(e.target as Node) &&
        kindBtnRef.current   && !kindBtnRef.current.contains(e.target as Node)
      ) setKindPanelPos(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [kindPanelPos])

  const openKindPanel = () => {
    if (!kindBtnRef.current) return
    const r = kindBtnRef.current.getBoundingClientRect()
    const PANEL_W = 140
    const left = (r.left + PANEL_W > window.innerWidth - 8) ? Math.max(8, r.right - PANEL_W) : r.left
    setKindPanelPos({ top: r.bottom + 2, left })
  }

  const save = async () => {
    if (!name.trim()) { onCancel(); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/sub-item-columns`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          col_key:        `col_${Date.now()}`,
          name:           name.trim(),
          kind,
          position,
          source_col_key: sourceColKey || null,
          view_id:        viewId,
        }),
      })
      if (!res.ok) { console.error('[AddColumnInline] failed:', res.status, await res.text()); onCancel(); return }
      const col = (await res.json()) as SubItemColumn
      onCreated(col)
    } catch (e) {
      console.error('[AddColumnInline] error:', e)
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="relative z-20 flex items-center gap-1 flex-none normal-case font-normal tracking-normal select-auto"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nombre..."
          disabled={saving}
          className="w-28 text-[12px] border border-[var(--brand)] rounded px-1.5 py-0.5 outline-none bg-white"
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <button
          ref={kindBtnRef}
          type="button"
          disabled={saving}
          onClick={openKindPanel}
          className="text-[11px] border border-[var(--border)] rounded px-1.5 py-0.5 bg-white text-[var(--ink)] hover:border-[var(--brand)] whitespace-nowrap"
        >
          {currentKindLabel} ▾
        </button>
        {sourceBoardId && sourceCols.length > 0 && (
          <select
            value={sourceColKey}
            onChange={e => setSourceColKey(e.target.value)}
            disabled={saving}
            onMouseDown={e => e.stopPropagation()}
            title="Vincular a columna del board fuente (opcional)"
            className="text-[11px] border border-[var(--border)] rounded px-1 py-0.5 outline-none bg-white text-[var(--ink-3)] max-w-[90px]"
          >
            <option value="">Sin vínculo</option>
            {sourceCols.map(c => (
              <option key={c.col_key} value={c.col_key}>{c.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="text-[var(--brand)] hover:text-[var(--brand-deep)] transition-colors text-[13px] leading-none px-0.5"
        >
          ✓
        </button>
        <button
          onClick={onCancel}
          className="text-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors text-[14px] leading-none px-0.5"
        >
          ×
        </button>
      </div>

      {kindPanelPos && createPortal(
        <div
          ref={kindPanelRef}
          style={{ position: 'fixed', top: kindPanelPos.top, left: kindPanelPos.left, zIndex: 9999 }}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg py-1 w-36"
          onMouseDown={e => e.stopPropagation()}
        >
          {COL_KIND_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { setKind(o.value); setKindPanelPos(null) }}
              className={`w-full text-left text-[12px] px-3 py-1 transition-colors ${
                kind === o.value
                  ? 'bg-[var(--brand-soft)] text-[var(--brand)] font-medium'
                  : 'text-[var(--ink)] hover:bg-[var(--surface-2)]'
              }`}
            >{o.label}</button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
