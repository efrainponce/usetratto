'use client'

import React from 'react'
import type { Block, RenderContext } from './types'
import { resolveTemplate, resolveField, withRepeatScope, formatValue } from './resolver'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function parseInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function getFieldLabel(context: RenderContext, col_key: string): string {
  const columns = context.current?.scope === 'sub_item' ? context.subItemColumns : context.rootColumns
  const col = columns.find(c => c.col_key === col_key)
  return col?.name || col_key
}

function getFieldValue(context: RenderContext, col_key: string): string {
  const values = context.current?.item.values || context.rootItem.values
  const value = values[col_key]
  return value !== null && value !== undefined ? String(value) : ''
}

const baseStyles = {
  container: {
    fontFamily: 'var(--font-geist-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
    padding: '48px 56px',
    backgroundColor: 'var(--surface)',
    color: 'var(--ink)',
    lineHeight: '1.5',
    fontSize: '13px'
  },
  heading: {
    fontWeight: 'bold',
    marginTop: '8px',
    marginBottom: '12px'
  },
  h1: { fontSize: '22px', fontWeight: '600', color: 'var(--ink)' },
  h2: { fontSize: '16px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--ink-2)', marginTop: '24px', marginBottom: '12px' },
  h3: { fontSize: '14px', fontWeight: '500', color: 'var(--ink)' },
  text: {
    marginBottom: '8px',
    fontSize: '13px',
    color: 'var(--ink-2)',
    lineHeight: '1.5'
  },
  label: {
    color: 'var(--ink-3)',
    fontSize: '10px',
    marginBottom: '2px',
    display: 'block'
  },
  fieldValue: {
    color: 'var(--ink)',
    fontSize: '13px',
    fontWeight: '500'
  },
  fieldInline: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'flex-start',
    fontSize: '13px'
  },
  fieldInlineLabel: {
    color: 'var(--ink-3)',
    fontSize: '13px'
  },
  fieldStacked: {
    marginBottom: '12px'
  },
  imagePlaceholder: {
    backgroundColor: 'var(--bg-2)',
    border: '1px solid var(--border)',
    marginBottom: '8px'
  },
  divider: {
    borderBottom: '1px solid var(--border)',
    margin: '16px 0'
  },
  columnsContainer: {
    display: 'grid',
    gap: '16px',
    marginBottom: '8px'
  },
  tableContainer: {
    margin: '24px 0',
    overflowX: 'auto' as const
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const
  },
  tableHeaderCell: {
    textAlign: 'right' as const,
    padding: '8px 0',
    fontSize: '10.5px',
    color: 'var(--ink-4)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: '600',
    borderBottom: '1px solid var(--border)'
  },
  tableCell: {
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: '13px'
  },
  totalContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    marginLeft: 'auto',
    width: '280px',
    marginTop: '16px'
  },
  totalLabel: {
    color: 'var(--ink-2)',
    fontSize: '13px',
    display: 'flex',
    justifyContent: 'space-between'
  },
  totalValue: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--ink)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: '8px',
    borderTop: '2px solid var(--ink)',
    marginTop: '4px'
  },
  signatureBox: {
    marginTop: '60px',
    width: '320px'
  },
  signatureSlot: {
    height: '60px',
    display: 'flex',
    alignItems: 'flex-end',
    fontSize: '11px',
    fontStyle: 'italic',
    color: 'var(--ink-3)'
  },
  signatureLine: {
    height: '1px',
    backgroundColor: 'var(--ink)',
    width: '100%',
    marginTop: '8px'
  },
  signatureLabel: {
    color: 'var(--ink-3)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    fontWeight: '600',
    marginBottom: '8px'
  },
  signatureName: {
    fontSize: '13px',
    marginTop: '6px',
    fontWeight: '500'
  },
  signaturePosition: {
    fontSize: '11px',
    marginTop: '1px',
    color: 'var(--ink-3)'
  }
}

function renderBlock(block: Block, context: RenderContext, style?: Record<string, unknown>): React.ReactElement {
  switch (block.type) {
    case 'heading': {
      const resolved = resolveTemplate(context, block.text)
      const levelStyles = block.level === 1
        ? baseStyles.h1
        : block.level === 2
          ? baseStyles.h2
          : baseStyles.h3
      const headingStyle = {
        ...baseStyles.heading,
        ...levelStyles,
        textAlign: block.align || 'left'
      }
      const Tag = (`h${block.level}` as unknown) as React.ElementType
      return (
        <Tag key={block.id} style={headingStyle}>
          {resolved}
        </Tag>
      )
    }

    case 'text': {
      const resolved = resolveTemplate(context, block.content)
      const htmlContent = parseInlineMarkdown(resolved)
      return (
        <p
          key={block.id}
          style={{ ...baseStyles.text, textAlign: block.align || 'left' }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )
    }

    case 'field': {
      const label = block.label || getFieldLabel(context, block.col_key)
      const value = getFieldValue(context, block.col_key)
      const colMeta = context.current?.scope === 'sub_item'
        ? context.subItemColumns.find(c => c.col_key === block.col_key)
        : context.rootColumns.find(c => c.col_key === block.col_key)
      const isMonoKind = colMeta?.kind && ['number', 'currency', 'date', 'phone'].includes(colMeta.kind)

      if (block.layout === 'inline') {
        return (
          <div key={block.id} style={baseStyles.fieldInline}>
            <span style={baseStyles.fieldInlineLabel}>{label}:</span>
            <span style={{...baseStyles.fieldValue, fontFamily: isMonoKind ? 'var(--font-geist-mono, monospace)' : 'inherit'}}>
              {value}
            </span>
          </div>
        )
      }
      return (
        <div key={block.id} style={baseStyles.fieldStacked}>
          <label style={baseStyles.label}>{label}</label>
          <div style={{...baseStyles.fieldValue, fontFamily: isMonoKind ? 'var(--font-geist-mono, monospace)' : 'inherit'}}>
            {value}
          </div>
        </div>
      )
    }

    case 'image': {
      let source: string | null = null

      if (block.source === 'url') {
        source = block.url || null
      } else if (block.source === 'col') {
        const values = context.current?.item.values || context.rootItem.values
        const val = values[block.col_key || '']
        if (typeof val === 'string') {
          source = val
        } else if (Array.isArray(val) && val.length > 0) {
          const file = val[0]
          if (typeof file === 'object' && file !== null && 'url' in file) {
            source = (file as { url: string }).url
          }
        }
      }

      const width = block.width ? `${block.width}px` : '200px'
      const height = block.height ? `${block.height}px` : '150px'

      if (!source) {
        return (
          <div
            key={block.id}
            style={{
              ...baseStyles.imagePlaceholder,
              width,
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{fontSize: '10px', color: 'var(--ink-3)'}}>Sin imagen</span>
          </div>
        )
      }

      return (
        <div key={block.id} style={{ marginBottom: '16px', textAlign: block.align || 'left' }}>
          <img src={source} style={{ width, height, objectFit: 'cover' }} alt="" />
        </div>
      )
    }

    case 'columns': {
      const numCols = block.children.length
      const gridTemplate = block.children
        .map(col => col.width.endsWith('fr') ? col.width : `${col.width}`)
        .join(' ')

      const childrenViews = block.children.map((col, idx) => (
        <div key={idx}>
          {col.blocks.map(childBlock => renderBlock(childBlock, context, style))}
        </div>
      ))

      return (
        <div key={block.id} style={{
          ...baseStyles.columnsContainer,
          gridTemplateColumns: gridTemplate,
          gap: `${block.gap || 16}px`
        }}>
          {childrenViews}
        </div>
      )
    }

    case 'spacer': {
      return <div key={block.id} style={{ height: `${block.height}px` }} />
    }

    case 'divider': {
      return (
        <div
          key={block.id}
          style={{
            ...baseStyles.divider,
            borderBottomWidth: `${block.thickness || 1}px`,
            borderBottomColor: block.color || '#e5e7eb'
          }}
        />
      )
    }

    case 'repeat': {
      let items: Array<{ id: string; name: string; values: Record<string, unknown> }> = []

      if (block.source === 'sub_items') {
        items = context.subItems as any
      } else if (block.source === 'relation' && block.source_col_key) {
        items = (context.relationItems?.[block.source_col_key] || []) as any
      }

      if (items.length === 0) {
        if (block.empty_text) {
          return <p key={block.id} style={baseStyles.text}>{block.empty_text}</p>
        }
        return <div key={block.id} />
      }

      const scope = block.source === 'sub_items' ? 'sub_item' : ('relation' as const)
      return (
        <div key={block.id}>
          {items.map((item: any, idx: number) => {
            const itemContext = withRepeatScope(context, scope, item as any)
            return (
              <div key={item.id}>
                {block.blocks.map(childBlock => renderBlock(childBlock, itemContext, style))}
                {idx < items.length - 1 && (
                  <div style={{borderBottom: '1px solid var(--border)', margin: '16px 0'}} />
                )}
              </div>
            )
          })}
        </div>
      )
    }

    case 'subitems_table': {
      const columns = block.columns
      const columnMetas = columns.map(col_key =>
        context.subItemColumns.find(c => c.col_key === col_key) || { col_key, name: col_key, kind: 'text' as any }
      )

      return (
        <div key={block.id} style={baseStyles.tableContainer}>
          <div style={{...baseStyles.table, display: 'flex', flexDirection: 'column'}}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr 100px 100px 110px',
              gap: '12px',
              fontSize: '10.5px',
              color: 'var(--ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: '600',
              padding: '8px 0',
              borderBottom: '1px solid var(--border)'
            }}>
              {columnMetas.map(meta => (
                <div key={meta.col_key} style={{textAlign: ['cantidad', 'precio', 'importe'].includes(meta.col_key) ? 'right' : 'left'}}>
                  {meta.name}
                </div>
              ))}
            </div>

            {/* Body rows */}
            {context.subItems.map(item => (
              <div key={item.id} style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 100px 100px 110px',
                gap: '12px',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '13px'
              }}>
                {columns.map((col_key, idx) => {
                  const meta = columnMetas[idx]
                  const value = item.values[col_key] ?? ''
                  const isNumeric = ['number', 'currency'].includes(meta?.kind || '')
                  return (
                    <div
                      key={col_key}
                      style={{
                        textAlign: isNumeric ? 'right' : 'left',
                        fontFamily: isNumeric ? 'var(--font-geist-mono, monospace)' : 'inherit'
                      }}
                    >
                      {value}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Totals row */}
            {block.show_totals && block.total_col_keys && block.total_col_keys.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 100px 100px 110px',
                gap: '12px',
                alignItems: 'center',
                padding: '10px 0',
                borderTop: '1px solid var(--border)',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                {columns.map((col_key, idx) => {
                  const meta = columnMetas[idx]
                  if (block.total_col_keys?.includes(col_key)) {
                    const sum = context.subItems.reduce((acc, item) => {
                      const val = parseFloat(String(item.values[col_key] ?? 0))
                      return acc + (isNaN(val) ? 0 : val)
                    }, 0)
                    const isNumeric = ['number', 'currency'].includes(meta?.kind || '')
                    return (
                      <div
                        key={col_key}
                        style={{
                          textAlign: isNumeric ? 'right' : 'left',
                          fontFamily: isNumeric ? 'var(--font-geist-mono, monospace)' : 'inherit',
                          color: 'var(--ink)'
                        }}
                      >
                        {sum.toFixed(2)}
                      </div>
                    )
                  }
                  return <div key={col_key}></div>
                })}
              </div>
            )}
          </div>
        </div>
      )
    }

    case 'total': {
      let value: number | null = null

      if (block.source === 'static') {
        value = block.value ?? null
      } else if (block.source === 'rollup' || block.source === 'formula') {
        const val = context.rootItem.values[block.col_key || '']
        if (val !== null && val !== undefined) {
          value = parseFloat(String(val))
        }
      }

      const displayValue = value !== null ? formatValue(value, block.format) : ''
      const label = block.label || 'Total'

      return (
        <div key={block.id} style={baseStyles.totalContainer}>
          <div style={{...baseStyles.totalLabel, display: 'flex', justifyContent: 'space-between'}}>
            <span>{label}</span>
          </div>
          <div style={{...baseStyles.totalValue, fontFamily: 'var(--font-geist-mono, monospace)', display: 'flex', justifyContent: 'space-between'}}>
            <span></span>
            <span>{displayValue}</span>
          </div>
        </div>
      )
    }

    case 'signature': {
      const sig = context.document?.signatures?.find(s => s.role === block.role)
      const roleLabel = block.label || `Firma de ${block.role}`

      if (sig && sig.image_url) {
        return (
          <div key={block.id} style={baseStyles.signatureBox}>
            <div style={baseStyles.signatureLabel}>{roleLabel}</div>
            <div style={baseStyles.signatureSlot}>
              <img src={sig.image_url} style={{ width: '100px', height: '50px' }} />
            </div>
            <div style={baseStyles.signatureLine}></div>
            {sig.user_name && <div style={baseStyles.signatureName}>{sig.user_name}</div>}
            {sig.signed_at && <div style={baseStyles.signaturePosition}>{sig.signed_at}</div>}
          </div>
        )
      }

      return (
        <div key={block.id} style={baseStyles.signatureBox}>
          <div style={baseStyles.signatureLabel}>{roleLabel}</div>
          <div style={baseStyles.signatureSlot}>
            Esperando firma
          </div>
          <div style={baseStyles.signatureLine}></div>
          <div style={baseStyles.signatureName}></div>
        </div>
      )
    }

    default: {
      const _exhaustive: never = block
      return <div key={(block as any).id} />
    }
  }
}

export function DocumentHtmlPreview({
  blocks,
  context,
  style
}: {
  blocks: Block[]
  context: RenderContext
  style?: Record<string, unknown>
}): React.ReactElement {
  return (
    <div className="document-preview" style={baseStyles.container as React.CSSProperties}>
      {style && (style.logo_url as string) && (
        <div style={{ marginBottom: '24px' }}>
          <img src={style.logo_url as string} style={{ width: '60px', height: '60px' }} alt="Logo" />
        </div>
      )}
      {blocks.map(block => renderBlock(block, context, style))}
    </div>
  )
}
