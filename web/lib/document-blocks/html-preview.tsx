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
    fontFamily: 'Helvetica, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '48px',
    backgroundColor: '#fff',
    color: '#000',
    lineHeight: '1.4',
    fontSize: '11pt'
  },
  heading: {
    marginBottom: '12px',
    marginTop: '8px',
    fontWeight: 'bold'
  },
  h1: { fontSize: '24pt' },
  h2: { fontSize: '18pt' },
  h3: { fontSize: '14pt' },
  text: {
    marginBottom: '8px'
  },
  label: {
    color: '#6b7280',
    fontSize: '10pt',
    marginBottom: '2px',
    display: 'block'
  },
  fieldValue: {
    color: '#000',
    fontSize: '11pt'
  },
  fieldInline: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'flex-start'
  },
  fieldInlineLabel: {
    color: '#6b7280',
    fontSize: '10pt'
  },
  fieldStacked: {
    marginBottom: '12px'
  },
  imagePlaceholder: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    marginBottom: '8px'
  },
  divider: {
    borderBottom: '1px solid #e5e7eb',
    margin: '8px 0'
  },
  columnsContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px'
  },
  tableContainer: {
    margin: '8px 0',
    overflowX: 'auto' as const
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const
  },
  tableHeaderCell: {
    textAlign: 'left' as const,
    padding: '4px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 'bold',
    fontSize: '10pt'
  },
  tableCell: {
    padding: '4px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '10pt'
  },
  totalContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '16px',
    margin: '12px 0',
    alignItems: 'flex-end'
  },
  totalLabel: {
    color: '#6b7280',
    fontSize: '11pt'
  },
  totalValue: {
    fontSize: '16pt',
    fontWeight: 'bold',
    color: '#000'
  },
  signatureBox: {
    border: '1px solid #e5e7eb',
    padding: '40px 8px 8px 8px',
    marginBottom: '12px'
  },
  signatureLabel: {
    color: '#6b7280',
    fontSize: '10pt',
    marginBottom: '32px'
  },
  signatureName: {
    fontSize: '10pt',
    marginTop: '8px'
  }
}

function renderBlock(block: Block, context: RenderContext, style?: Record<string, unknown>): React.ReactElement {
  switch (block.type) {
    case 'heading': {
      const resolved = resolveTemplate(context, block.text)
      const headingStyle = {
        ...baseStyles.heading,
        ...(block.level === 1
          ? baseStyles.h1
          : block.level === 2
            ? baseStyles.h2
            : baseStyles.h3),
        textAlign: block.align || 'left',
        color: (style?.primaryColor as string) || '#000'
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

      if (block.layout === 'inline') {
        return (
          <div key={block.id} style={baseStyles.fieldInline}>
            <span style={baseStyles.fieldInlineLabel}>{label}:</span>
            <span style={baseStyles.fieldValue}>{value}</span>
          </div>
        )
      }
      return (
        <div key={block.id} style={baseStyles.fieldStacked}>
          <label style={baseStyles.label}>{label}</label>
          <div style={baseStyles.fieldValue}>{value}</div>
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

      if (!source) {
        return (
          <div
            key={block.id}
            style={{
              ...baseStyles.imagePlaceholder,
              width: block.width ? `${block.width}px` : '200px',
              height: block.height ? `${block.height}px` : '150px'
            }}
          />
        )
      }

      return (
        <div key={block.id} style={{ marginBottom: '8px', textAlign: block.align || 'left' }}>
          <img src={source} style={{ width: block.width ? `${block.width}px` : '200px', height: block.height ? `${block.height}px` : '150px' }} />
        </div>
      )
    }

    case 'columns': {
      const childrenViews = block.children.map((col, idx) => {
        let colWidth = col.width
        if (col.width.endsWith('fr')) {
          const frValue = parseInt(col.width.split('fr')[0])
          colWidth = `${(frValue / block.children.length) * 100}%`
        }

        return (
          <div
            key={idx}
            style={{
              flex: col.width.endsWith('fr') ? parseInt(col.width.split('fr')[0]) : undefined,
              width: col.width.endsWith('fr') ? undefined : colWidth,
              gap: `${block.gap || 8}px`
            }}
          >
            {col.blocks.map(childBlock => renderBlock(childBlock, context, style))}
          </div>
        )
      })

      return (
        <div key={block.id} style={{ ...baseStyles.columnsContainer, gap: `${block.gap || 8}px` }}>
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
          return <p key={block.id}>{block.empty_text}</p>
        }
        return <div key={block.id} />
      }

      const scope = block.source === 'sub_items' ? 'sub_item' : ('relation' as const)
      return (
        <div key={block.id}>
          {items.map((item: any) => {
            const itemContext = withRepeatScope(context, scope, item as any)
            return (
              <div key={item.id}>
                {block.blocks.map(childBlock => renderBlock(childBlock, itemContext, style))}
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
          <table style={baseStyles.table}>
            <thead>
              <tr>
                {columnMetas.map(meta => (
                  <th key={meta.col_key} style={baseStyles.tableHeaderCell}>
                    {meta.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {context.subItems.map(item => (
                <tr key={item.id}>
                  {columns.map(col_key => (
                    <td key={col_key} style={baseStyles.tableCell}>
                      {item.values[col_key] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
              {block.show_totals && block.total_col_keys && block.total_col_keys.length > 0 && (
                <tr>
                  {columns.map(col_key => {
                    if (block.total_col_keys?.includes(col_key)) {
                      const sum = context.subItems.reduce((acc, item) => {
                        const val = parseFloat(String(item.values[col_key] ?? 0))
                        return acc + (isNaN(val) ? 0 : val)
                      }, 0)
                      return (
                        <td key={col_key} style={{ ...baseStyles.tableCell, fontWeight: 'bold' }}>
                          {sum.toFixed(2)}
                        </td>
                      )
                    }
                    return (
                      <td key={col_key} style={baseStyles.tableCell}>

                      </td>
                    )
                  })}
                </tr>
              )}
            </tbody>
          </table>
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
          <div style={baseStyles.totalLabel}>{label}</div>
          <div style={baseStyles.totalValue}>{displayValue}</div>
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
            <img src={sig.image_url} style={{ width: '100px', height: '50px', marginBottom: '8px' }} />
            {sig.user_name && <div style={baseStyles.signatureName}>{sig.user_name}</div>}
            {sig.signed_at && <div style={{ fontSize: '9pt', color: '#9ca3af' }}>{sig.signed_at}</div>}
          </div>
        )
      }

      return (
        <div key={block.id} style={baseStyles.signatureBox}>
          <div style={baseStyles.signatureLabel}>{roleLabel}</div>
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
        <div style={{ marginBottom: '16px' }}>
          <img src={style.logo_url as string} style={{ width: '60px', height: '60px' }} />
        </div>
      )}
      {blocks.map(block => renderBlock(block, context, style))}
    </div>
  )
}
