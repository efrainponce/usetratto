'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentHtmlPreview } from '@/lib/document-blocks/html-preview'
import { buildSampleContext } from '@/lib/document-blocks/sample-context'
import { buildQuoteBody, DEFAULT_QUOTE_CONFIG, DEFAULT_COLUMN_WIDTHS, type QuoteConfig } from '@/lib/document-blocks/defaults'
import type { BoardColumnMeta, RenderContext } from '@/lib/document-blocks'

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

type SubItemColumn = { id: string; col_key: string; name: string; kind: string; settings?: Record<string, unknown> }

type TemplateEditorViewProps = {
  template:        TemplateData
  board:           { id: string; name: string; sid: number; workspace_id: string }
  columns:         SubItemColumn[]
  subItemColumns:  SubItemColumn[]
  workspace:       { id: string; name: string; logo_url?: string }
  workspaceSid:    string
  onClose?:        () => void
  liveItem?: {
    rootItem: { id: string; sid: number; name: string; values: Record<string, string | number | null> }
    subItems: Array<{ id: string; sid: number; name: string; values: Record<string, string | number | null> }>
  } | null
}

// Orden canónico de columnas del catálogo (las que conocemos) — las demás se agregan después.
const CATALOG_ORDER = ['sku', 'descripcion', 'cantidad', 'unidad', 'unit_price', 'subtotal']

function toMeta(cols: SubItemColumn[]): BoardColumnMeta[] {
  return cols.map(c => ({ col_key: c.col_key, name: c.name, kind: c.kind as any, settings: c.settings }))
}

function readConfig(style: unknown): QuoteConfig {
  const obj = (style && typeof style === 'object' ? (style as Record<string, unknown>) : {})
  const cfg = obj.quote_config as Partial<QuoteConfig> | undefined
  return {
    tableColumns:        Array.isArray(cfg?.tableColumns) && cfg!.tableColumns.length ? cfg!.tableColumns as string[] : DEFAULT_QUOTE_CONFIG.tableColumns,
    columnWidths:        (cfg?.columnWidths && typeof cfg.columnWidths === 'object') ? cfg.columnWidths as Record<string, number> : { ...DEFAULT_COLUMN_WIDTHS },
    showThumbnail:       cfg?.showThumbnail       ?? DEFAULT_QUOTE_CONFIG.showThumbnail,
    fontSize:            typeof cfg?.fontSize === 'number' ? cfg!.fontSize as number : DEFAULT_QUOTE_CONFIG.fontSize,
    ivaRate:             typeof cfg?.ivaRate === 'number' ? cfg!.ivaRate as number : DEFAULT_QUOTE_CONFIG.ivaRate,
    header:              cfg?.header              ?? DEFAULT_QUOTE_CONFIG.header,
    notesLabel:          cfg?.notesLabel          ?? DEFAULT_QUOTE_CONFIG.notesLabel,
    notes:               cfg?.notes               ?? DEFAULT_QUOTE_CONFIG.notes,
    showClientSignature: cfg?.showClientSignature ?? DEFAULT_QUOTE_CONFIG.showClientSignature,
    showVendorSignature: cfg?.showVendorSignature ?? DEFAULT_QUOTE_CONFIG.showVendorSignature,
  }
}

export default function TemplateEditorView({
  template, board: _board, columns, subItemColumns, workspace, workspaceSid: _workspaceSid, onClose, liveItem,
}: TemplateEditorViewProps) {
  const router = useRouter()
  const handleClose = onClose ?? (() => router.back())

  const [name,     setName]     = useState(template.name)
  const [config,   setConfig]   = useState<QuoteConfig>(() => readConfig(template.style_json))
  const [savedAt,  setSavedAt]  = useState<Date | null>(null)
  const [isDirty,  setIsDirty]  = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const rootColsMeta = useMemo(() => toMeta(columns),         [columns])
  const subColsMeta  = useMemo(() => toMeta(subItemColumns),  [subItemColumns])
  const blocks       = useMemo(() => buildQuoteBody(config),  [config])
  const styleForPreview = useMemo(() => ({ quote_config: config }), [config])

  const sampleContext: RenderContext = liveItem
    ? {
        rootItem:       liveItem.rootItem,
        rootColumns:    rootColsMeta,
        subItems:       liveItem.subItems,
        subItemColumns: subColsMeta,
        workspace:      { name: workspace.name, logo_url: workspace.logo_url },
      }
    : buildSampleContext(rootColsMeta, subColsMeta, workspace)

  // ── Auto-save ────────────────────────────────────────────────────────────
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const latest = useRef({ name, config, blocks })
  latest.current = { name, config, blocks }

  const triggerAutoSave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      const { name: n, config: c, blocks: b } = latest.current
      setIsSaving(true)
      try {
        const res = await fetch(`/api/document-templates/${template.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:       n.trim() || 'Plantilla',
            body_json:  b,
            style_json: { quote_config: c },
          }),
        })
        if (res.ok) {
          setSavedAt(new Date())
          setIsDirty(false)
        }
      } catch (err) {
        console.error('[template auto-save]', err)
      } finally {
        setIsSaving(false)
      }
    }, 1200)
  }, [template.id])

  const patchConfig = (patch: Partial<QuoteConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }))
    setIsDirty(true)
    triggerAutoSave()
  }

  const handleNameChange = (v: string) => {
    setName(v)
    setIsDirty(true)
    triggerAutoSave()
  }

  // ── Opciones de columnas disponibles para la tabla ───────────────────────
  // Orden: las conocidas primero (sku, descripcion…), luego custom. Excluimos
  // foto (rendering en tabla aún no soporta image kind — se usa miniatura).
  const availableTableCols = useMemo(() => {
    const byKey  = new Map(subItemColumns.map(c => [c.col_key, c]))
    const result: SubItemColumn[] = []
    for (const k of CATALOG_ORDER) {
      const c = byKey.get(k)
      if (c) { result.push(c); byKey.delete(k) }
    }
    for (const c of byKey.values()) {
      if (c.col_key === 'foto' || c.col_key === 'name') continue
      result.push(c)
    }
    return result
  }, [subItemColumns])

  const toggleTableCol = (col_key: string) => {
    const exists = config.tableColumns.includes(col_key)
    if (exists) {
      patchConfig({ tableColumns: config.tableColumns.filter(k => k !== col_key) })
    } else {
      // Append al final conservando orden existente
      patchConfig({ tableColumns: [...config.tableColumns, col_key] })
    }
  }

  const setColumnWidth = (col_key: string, pct: number) => {
    patchConfig({
      columnWidths: { ...config.columnWidths, [col_key]: Math.max(1, Math.min(100, pct)) },
    })
  }

  // ── Drag & drop para reordenar columnas activas ──────────────────────────
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const handleDrop = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null); setDragOverKey(null); return
    }
    const activeOrdered = config.tableColumns.filter(k => k !== dragKey)
    const targetIdx = activeOrdered.indexOf(targetKey)
    if (targetIdx < 0) {
      setDragKey(null); setDragOverKey(null); return
    }
    const next = [...activeOrdered]
    next.splice(targetIdx, 0, dragKey)
    patchConfig({ tableColumns: next })
    setDragKey(null); setDragOverKey(null)
  }

  // Ancho total relativo (para normalizar visualmente a %)
  const activeWidthSum = useMemo(
    () => config.tableColumns.reduce((acc, k) => acc + (config.columnWidths[k] ?? 10), 0),
    [config.tableColumns, config.columnWidths]
  )

  const distributeEvenly = () => {
    const n = config.tableColumns.length
    if (!n) return
    const each = Math.max(1, Math.round(100 / n))
    const next: Record<string, number> = { ...config.columnWidths }
    for (const k of config.tableColumns) next[k] = each
    patchConfig({ columnWidths: next })
  }

  // ── UI helpers ───────────────────────────────────────────────────────────
  const formatSavedTime = () => {
    if (!savedAt) return null
    const diff = Math.round((Date.now() - savedAt.getTime()) / 1000)
    if (diff < 5)   return 'guardado'
    if (diff < 60)  return 'guardado hace un momento'
    if (diff < 3600) return `guardado hace ${Math.round(diff / 60)}m`
    return `guardado hace ${Math.round(diff / 3600)}h`
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-2)]">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-[var(--border)] bg-[var(--bg)] flex-none">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-[family-name:var(--font-geist-mono)] text-[11.5px] text-[var(--ink-4)] tabular-nums tracking-tight shrink-0">
            COT-{String(template.sid).padStart(4, '0')}
          </span>
          <span className="w-px h-4 bg-[var(--border)] shrink-0" />
          <input
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            className="font-[family-name:var(--font-geist-mono)] text-[14px] font-semibold uppercase tracking-[0.02em] text-[var(--ink)] bg-transparent border-0 outline-none px-0 py-0 w-full min-w-0"
            placeholder="Nombre de la plantilla"
          />
          <span className="text-[11.5px] text-[var(--ink-4)] shrink-0 tabular-nums">
            {isSaving ? 'guardando…' : (isDirty ? 'sin guardar' : formatSavedTime() ?? '')}
          </span>
        </div>
        <button
          onClick={handleClose}
          title="Cerrar"
          className="inline-flex items-center justify-center w-8 h-8 text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] rounded-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* ── Body: left config + right preview ──────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[300px] flex-none flex flex-col bg-[var(--bg-2)] border-r border-[var(--border)] overflow-y-auto">
          <Section title="Productos">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-[11.5px] text-[var(--ink-4)] leading-relaxed flex-1">
                Arrastra para reordenar. Ajusta el ancho relativo con el slider.
              </p>
              <button
                type="button"
                onClick={distributeEvenly}
                disabled={config.tableColumns.length === 0}
                className="font-[family-name:var(--font-geist-mono)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border)] rounded-sm px-2 py-1 whitespace-nowrap"
                title="Aplica el mismo ancho a todas las columnas activas"
              >
                distribuir
              </button>
            </div>

            {/* Columnas activas (ordenables) */}
            <div className="flex flex-col gap-0.5 mb-3">
              {config.tableColumns.map(colKey => {
                const col = availableTableCols.find(c => c.col_key === colKey)
                if (!col) return null
                const pct     = config.columnWidths[colKey] ?? 10
                const pctNorm = activeWidthSum > 0 ? Math.round((pct / activeWidthSum) * 100) : 0
                const isDragging = dragKey === colKey
                const isOver     = dragOverKey === colKey && dragKey !== colKey
                return (
                  <div
                    key={colKey}
                    onDragOver={e  => { e.preventDefault(); setDragOverKey(colKey) }}
                    onDrop={e      => { e.preventDefault(); handleDrop(colKey) }}
                    className={`group rounded-sm border transition-colors ${
                      isOver ? 'border-[var(--brand)] bg-[var(--surface)]'
                             : 'border-transparent hover:bg-[var(--surface)]'
                    } ${isDragging ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-2 px-1.5 py-1.5">
                      <span
                        draggable
                        onDragStart={() => setDragKey(colKey)}
                        onDragEnd={()   => { setDragKey(null); setDragOverKey(null) }}
                        className="cursor-grab active:cursor-grabbing text-[var(--ink-4)] group-hover:text-[var(--ink-3)] select-none"
                        title="Arrastra para reordenar"
                      >
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.2"/><circle cx="2" cy="7" r="1.2"/><circle cx="2" cy="12" r="1.2"/><circle cx="8" cy="2" r="1.2"/><circle cx="8" cy="7" r="1.2"/><circle cx="8" cy="12" r="1.2"/></svg>
                      </span>
                      <input
                        type="checkbox"
                        checked
                        onChange={() => toggleTableCol(colKey)}
                        className="accent-[var(--brand)]"
                      />
                      <span className="text-[13px] text-[var(--ink)] flex-1 truncate">{col.name}</span>
                      <span className="font-[family-name:var(--font-geist-mono)] text-[10.5px] text-[var(--ink-4)] tabular-nums w-[28px] text-right">{pctNorm}%</span>
                    </div>
                    <div className="px-2 pb-2">
                      <input
                        type="range"
                        min={1}
                        max={60}
                        step={1}
                        value={pct}
                        onChange={e => setColumnWidth(colKey, parseInt(e.target.value, 10))}
                        className="w-full accent-[var(--brand)] h-1"
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Columnas disponibles (no activas) */}
            {availableTableCols.some(c => !config.tableColumns.includes(c.col_key)) && (
              <>
                <div className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--ink-4)] uppercase tracking-[0.08em] px-1 pb-1">
                  disponibles
                </div>
                <div className="flex flex-col gap-0.5">
                  {availableTableCols.filter(c => !config.tableColumns.includes(c.col_key)).map(col => (
                    <label key={col.col_key} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-[var(--surface)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleTableCol(col.col_key)}
                        className="accent-[var(--brand)]"
                      />
                      <span className="text-[13px] text-[var(--ink-3)] flex-1">{col.name}</span>
                      <span className="font-[family-name:var(--font-geist-mono)] text-[10.5px] text-[var(--ink-4)]">{col.col_key}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <label className="flex items-center gap-2 mt-3 px-2 py-1.5 rounded-sm hover:bg-[var(--surface)] cursor-pointer">
              <input
                type="checkbox"
                checked={config.showThumbnail}
                onChange={e => patchConfig({ showThumbnail: e.target.checked })}
                className="accent-[var(--brand)]"
              />
              <span className="text-[13px] text-[var(--ink)]">Miniatura a la izquierda</span>
            </label>
          </Section>

          <Section title="Encabezado">
            <p className="text-[11.5px] text-[var(--ink-4)] leading-relaxed mb-2">
              Texto que aparece arriba (intro, vigencia, términos generales).
            </p>
            <textarea
              value={config.header}
              onChange={e => patchConfig({ header: e.target.value })}
              rows={3}
              placeholder="Ej: Estimado cliente, a continuación presentamos nuestra propuesta…"
              className="w-full text-[13px] text-[var(--ink)] bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-1.5 outline-none focus:border-[var(--brand)] resize-y"
            />
          </Section>

          <Section title="Tipografía">
            <label className="flex items-center gap-3 px-2 py-1.5">
              <span className="text-[13px] text-[var(--ink)] flex-1">Tamaño</span>
              <input
                type="range"
                min={10}
                max={16}
                step={1}
                value={config.fontSize}
                onChange={e => patchConfig({ fontSize: parseInt(e.target.value, 10) })}
                className="flex-1 accent-[var(--brand)] h-1"
              />
              <span className="font-[family-name:var(--font-geist-mono)] text-[13px] tabular-nums text-[var(--ink)] w-[28px] text-right">{config.fontSize}</span>
              <span className="text-[11.5px] text-[var(--ink-3)]">px</span>
            </label>
          </Section>

          <Section title="Impuestos">
            <label className="flex items-center gap-3 px-2 py-1.5">
              <span className="text-[13px] text-[var(--ink)] flex-1">IVA</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={Math.round(config.ivaRate * 10000) / 100}
                onChange={e => {
                  const pct = parseFloat(e.target.value)
                  patchConfig({ ivaRate: isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct)) / 100 })
                }}
                className="w-[72px] font-[family-name:var(--font-geist-mono)] text-[13px] tabular-nums text-right text-[var(--ink)] bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-1 outline-none focus:border-[var(--brand)]"
              />
              <span className="text-[13px] text-[var(--ink-3)]">%</span>
            </label>
            <p className="text-[11.5px] text-[var(--ink-4)] leading-relaxed mt-2 px-2">
              0% para ocultar la fila de IVA.
            </p>
          </Section>

          <Section title="Notas">
            <p className="text-[11.5px] text-[var(--ink-4)] leading-relaxed mb-2">
              Título + texto libre al final del documento (términos, condiciones).
            </p>
            <input
              type="text"
              value={config.notesLabel}
              onChange={e => patchConfig({ notesLabel: e.target.value })}
              placeholder="Notas"
              className="w-full text-[13px] font-semibold text-[var(--ink)] bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-1.5 mb-1.5 outline-none focus:border-[var(--brand)]"
            />
            <textarea
              value={config.notes}
              onChange={e => patchConfig({ notes: e.target.value })}
              rows={4}
              placeholder="Ej: Precios en pesos mexicanos, válidos por 30 días…"
              className="w-full text-[13px] text-[var(--ink)] bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-1.5 outline-none focus:border-[var(--brand)] resize-y"
            />
          </Section>

          <Section title="Firmas">
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-[var(--surface)] cursor-pointer">
              <input
                type="checkbox"
                checked={config.showClientSignature}
                onChange={e => patchConfig({ showClientSignature: e.target.checked })}
                className="accent-[var(--brand)]"
              />
              <span className="text-[13px] text-[var(--ink)]">Firma del cliente</span>
            </label>
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-[var(--surface)] cursor-pointer">
              <input
                type="checkbox"
                checked={config.showVendorSignature}
                onChange={e => patchConfig({ showVendorSignature: e.target.checked })}
                className="accent-[var(--brand)]"
              />
              <span className="text-[13px] text-[var(--ink)]">Firma del vendedor</span>
            </label>
          </Section>
        </aside>

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-[var(--bg-2)] p-8">
          <div
            className="w-[816px] mx-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-md)] relative"
            style={{
              minHeight: '1056px',
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 1040px, color-mix(in oklab, var(--ink-4) 25%, transparent) 1040px, color-mix(in oklab, var(--ink-4) 25%, transparent) 1041px, transparent 1041px, transparent 1056px)`,
            }}
          >
            <DocumentHtmlPreview blocks={blocks} context={sampleContext} style={styleForPreview} />
          </div>
          <div className="text-center text-[10.5px] text-[var(--ink-4)] mt-4 font-[family-name:var(--font-geist-mono)]">
            Carta · 8.5 × 11 in · vista previa
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[var(--border)]">
      <div className="font-[family-name:var(--font-geist-mono)] text-[10.5px] text-[var(--ink-4)] uppercase tracking-[0.08em] font-semibold px-1 pb-2.5">
        {title}
      </div>
      {children}
    </div>
  )
}
