'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BlockCanvas } from '@/components/templates/BlockCanvas'
import { BlockPalette } from '@/components/templates/BlockPalette'
import { DocumentHtmlPreview } from '@/lib/document-blocks/html-preview'
import { buildSampleContext } from '@/lib/document-blocks/sample-context'
import type { Block, BoardColumnMeta, RenderContext } from '@/lib/document-blocks'

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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 transition-colors"
            title="Volver"
          >
            ← Volver
          </button>

          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-900/20"
            placeholder="Nombre del template"
          />
        </div>

        <div className="flex items-center gap-3 ml-4">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as 'draft' | 'active' | 'archived')}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
          >
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </select>

          <div className="text-xs text-gray-500">
            {isSaving ? (
              <span>Guardando...</span>
            ) : savedAt ? (
              <span>Guardado {formatSavedTime()}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 3-panel layout: Palette | Canvas | Preview */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left: Palette */}
        <div className="w-80 overflow-y-auto">
          <BlockPalette onAdd={(block) => setBlocks([...blocks, block])} />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-lg p-4">
          <BlockCanvas
            blocks={blocks}
            onChange={handleBlocksChange}
            availableColumns={rootColsMeta}
            subItemColumns={subColsMeta}
          />
        </div>

        {/* Right: Preview */}
        <div className="w-96 overflow-y-auto bg-white border border-gray-200 rounded-lg p-4">
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-600 block mb-2">Vista previa</label>
            <select className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900/20">
              <option>Datos de muestra</option>
            </select>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-auto max-h-[calc(100vh-200px)]">
            <DocumentHtmlPreview blocks={blocks} context={sampleContext} style={style} />
          </div>
        </div>
      </div>
    </div>
  )
}
