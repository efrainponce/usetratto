'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const TemplateEditorView = dynamic(
  () => import('@/app/app/w/[workspaceSid]/settings/boards/[boardId]/templates/[tplId]/TemplateEditorView'),
  { ssr: false, loading: () => <ModalLoading /> }
)

type BoardColumn = {
  id: string
  col_key: string
  name: string
  kind: string
  settings?: Record<string, unknown>
}

type ContextData = {
  template: {
    id: string
    sid: number
    name: string
    target_board_id: string
    status: 'draft' | 'active' | 'archived'
    body_json: unknown
    style_json: unknown
    created_at: string
    updated_at: string
  }
  board:          { id: string; name: string; sid: number; workspace_id: string }
  columns:        BoardColumn[]
  subItemColumns: BoardColumn[]
  workspace:      { id: string; name: string; logo_url?: string }
}

type Props = {
  templateId:    string
  workspaceSid:  number
  onClose:       () => void
}

export function QuoteEditorModal({ templateId, workspaceSid, onClose }: Props) {
  const [data, setData]   = useState<ContextData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/document-templates/${templateId}/context`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText)
        return r.json() as Promise<ContextData>
      })
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message ?? 'Error al cargar plantilla') })
    return () => { cancelled = true }
  }, [templateId])

  // ESC key to close
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
        className="w-full max-w-[1400px] h-[calc(100vh-48px)] max-h-[900px] bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {data ? (
          <TemplateEditorView
            template={data.template}
            board={data.board}
            columns={data.columns}
            subItemColumns={data.subItemColumns}
            workspace={data.workspace}
            workspaceSid={String(workspaceSid)}
            onClose={onClose}
          />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-[13px] text-[var(--stage-lost)]">{error}</p>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[13px] text-[var(--ink-2)] hover:bg-[var(--surface-2)] rounded-sm"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <ModalLoading />
        )}
      </div>
    </div>
  )
}

function ModalLoading() {
  return (
    <div className="flex items-center justify-center h-full text-[13px] text-[var(--ink-4)]">
      Cargando editor de cotización…
    </div>
  )
}
