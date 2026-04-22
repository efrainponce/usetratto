'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { BlockPalette } from '@/components/templates/BlockPalette'
import { DocumentHtmlPreview } from '@/lib/document-blocks/html-preview'
import { buildSampleContext } from '@/lib/document-blocks/sample-context'
import type { Block, BoardColumnMeta, RenderContext } from '@/lib/document-blocks'

// BlockCanvas uses @dnd-kit which generates unique IDs on mount → hydration mismatch if SSR'd
const BlockCanvas = dynamic(
  () => import('@/components/templates/BlockCanvas').then(m => m.BlockCanvas),
  { ssr: false, loading: () => <div className="p-8 text-center text-[13px] text-[var(--ink-4)]">Cargando editor…</div> }
)

type TemplateData = {
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

type BoardData = {
  id: string
  name: string
  sid: number
  workspace_id: string
}

type WorkspaceData = {
  id: string
  name: string
  logo_url?: string
}

type TemplateEditorViewProps = {
  template: TemplateData
  board: BoardData
  columns: Array<{
    id: string
    col_key: string
    name: string
    kind: string
    settings?: Record<string, unknown>
  }>
  subItemColumns: Array<{
    id: string
    col_key: string
    name: string
    kind: string
    settings?: Record<string, unknown>
  }>
  workspace: WorkspaceData
  workspaceSid: string
}

function convertToBoardColumnMeta(cols: any[]): BoardColumnMeta[] {
  return cols.map((col) => ({
    col_key: col.col_key,
    name: col.name,
    kind: col.kind as any,
    settings: col.settings,
  }))
}

export default function TemplateEditorView({
  template,
  board,
  columns,
  subItemColumns,
  workspace,
  workspaceSid,
}: TemplateEditorViewProps) {
  const router = useRouter()

  const [blocks, setBlocks] = useState<Block[]>(
    Array.isArray(template.body_json) ? (template.body_json as Block[]) : []
  )
  const [name, setName] = useState(template.name)
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(template.status)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const rootColsMeta = convertToBoardColumnMeta(columns)
  const subColsMeta = convertToBoardColumnMeta(subItemColumns)

  const sampleContext: RenderContext = buildSampleContext(rootColsMeta, subColsMeta, workspace)

  const style = (template.style_json ?? {}) as Record<string, unknown>

  // Debounced auto-save
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const triggerAutoSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      await autoSave()
    }, 1500)
  }, [])

  const autoSave = useCallback(async () => {
    if (!isDirty || isSaving) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/document-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          body_json: blocks,
          status: status,
        }),
      })

      if (res.ok) {
        setSavedAt(new Date())
        setIsDirty(false)
      }
    } catch (error) {
      console.error('Auto-save error:', error)
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, isSaving, template.id, name, blocks, status])

  // Handle block changes
  const handleBlocksChange = (newBlocks: Block[]) => {
    setBlocks(newBlocks)
    setIsDirty(true)
    triggerAutoSave()
  }

  // Handle name change
  const handleNameChange = (newName: string) => {
    setName(newName)
    setIsDirty(true)
    triggerAutoSave()
  }

  // Handle status change
  const handleStatusChange = (newStatus: 'draft' | 'active' | 'archived') => {
    setStatus(newStatus)
    setIsDirty(true)
    triggerAutoSave()
  }

  // Format saved time
  const formatSavedTime = () => {
    if (!savedAt) return null
    const now = new Date()
    const diff = Math.round((now.getTime() - savedAt.getTime()) / 1000)
    if (diff < 60) return 'hace unos segundos'
    if (diff < 3600) return `hace ${Math.round(diff / 60)}m`
    if (diff < 86400) return `hace ${Math.round(diff / 3600)}h`
    return `hace ${Math.round(diff / 86400)}d`
  }

  const handleDownloadPdf = async () => {
    // Placeholder: el user puede ver el preview; la generación real es desde el item (no template)
    alert('Para generar PDF final, usa el botón "Generar PDF" en la vista de sub-items de la oportunidad.')
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-2)]">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-4 px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg)] flex-none">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="font-[family-name:var(--font-geist-mono)] text-[11.5px] text-[var(--ink-4)] tabular-nums tracking-tight">
            COT-{String(template.sid).padStart(4, '0')} · v1
            {isSaving && <span className="ml-2">· guardando…</span>}
            {!isSaving && savedAt && <span className="ml-2">· guardado {formatSavedTime()}</span>}
          </div>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="font-[family-name:var(--font-geist-mono)] text-[18px] font-semibold uppercase tracking-[0.02em] text-[var(--ink)] bg-transparent border-0 outline-none px-0 py-0 w-full"
            placeholder="Nombre del template"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as 'draft' | 'active' | 'archived')}
            className="px-2.5 py-1.5 text-[12px] text-[var(--ink-2)] bg-[var(--surface-2)] border border-[var(--border)] rounded-sm outline-none"
          >
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </select>
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[var(--ink-2)] hover:bg-[var(--surface-2)] rounded-sm transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            PDF
          </button>
          <button
            onClick={() => router.back()}
            title="Cerrar"
            className="inline-flex items-center justify-center w-8 h-8 text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] rounded-sm transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body: left sidebar (palette + variables) + middle (canvas) + right (preview paper) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[220px] flex-none flex flex-col bg-[var(--bg-2)] border-r border-[var(--border)] overflow-y-auto p-3 gap-4">
          <div>
            <div className="font-[family-name:var(--font-geist-mono)] text-[10.5px] text-[var(--ink-4)] uppercase tracking-[0.08em] font-semibold px-1 pb-2">Bloques</div>
            <BlockPalette onAdd={(block) => setBlocks([...blocks, block])} />
          </div>
          <div>
            <div className="font-[family-name:var(--font-geist-mono)] text-[10.5px] text-[var(--ink-4)] uppercase tracking-[0.08em] font-semibold px-1 pb-2">Variables</div>
            <div className="flex flex-col gap-1">
              {[
                '{{contacto.nombre}}',
                '{{institucion.nombre}}',
                '{{fecha.hoy}}',
                '{{cotizacion.total}}',
                '{{oportunidad.nombre}}',
                '{{monto|currency}}',
              ].map(v => (
                <div
                  key={v}
                  className="font-[family-name:var(--font-geist-mono)] text-[11.5px] text-[var(--ink-3)] bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-sm px-2 py-1"
                >
                  {v}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: canvas (block list, editable) */}
        <div className="w-[320px] flex-none bg-[var(--bg)] border-r border-[var(--border)] overflow-y-auto p-3">
          <div className="font-[family-name:var(--font-geist-mono)] text-[10.5px] text-[var(--ink-4)] uppercase tracking-[0.08em] font-semibold px-1 pb-2">Estructura</div>
          <BlockCanvas
            blocks={blocks}
            onChange={handleBlocksChange}
            availableColumns={rootColsMeta}
            subItemColumns={subColsMeta}
          />
        </div>

        {/* Right: paper preview */}
        <div className="flex-1 overflow-auto bg-[var(--bg-2)] p-8">
          <div className="max-w-[780px] mx-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-md)]">
            <DocumentHtmlPreview blocks={blocks} context={sampleContext} style={style} />
          </div>
        </div>
      </div>
    </div>
  )
}
