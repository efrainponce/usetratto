'use client'

import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Block, RenderContext, BoardColumnMeta } from './types'
import { resolveTemplate, resolveField, withRepeatScope, formatValue } from './resolver'

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.4
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8
  },
  heading2: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 8
  },
  heading3: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 6
  },
  text: {
    fontSize: 11,
    marginBottom: 8,
    color: '#000'
  },
  label: {
    color: '#6b7280',
    fontSize: 10,
    marginBottom: 2
  },
  fieldValue: {
    color: '#000',
    fontSize: 11
  },
  fieldInline: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start'
  },
  fieldStacked: {
    marginBottom: 12
  },
  imagePlaceholder: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    borderWidth: 1
  },
  divider: {
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    marginVertical: 8
  },
  tableContainer: {
    marginVertical: 8
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingVertical: 4
  },
  tableHeaderRow: {
    fontWeight: 'bold',
    backgroundColor: '#f9fafb'
  },
  tableCell: {
    paddingHorizontal: 4,
    fontSize: 10
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginVertical: 12,
    gap: 16
  },
  totalLabel: {
    color: '#6b7280',
    fontSize: 11
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000'
  },
  signatureBox: {
    borderColor: '#e5e7eb',
    borderWidth: 1,
    paddingVertical: 40,
    paddingHorizontal: 8,
    marginBottom: 12
  },
  signatureLabel: {
    color: '#6b7280',
    fontSize: 10,
    marginBottom: 32
  },
  signatureName: {
    fontSize: 10,
    marginTop: 8
  }
})

function parseInlineMarkdown(text: string): Array<{ type: 'text' | 'bold' | 'italic'; content: string }> {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  const parts = text.split(regex)

  return parts
    .filter(part => part)
    .map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { type: 'bold', content: part.slice(2, -2) }
      } else if (part.startsWith('*') && part.endsWith('*')) {
        return { type: 'italic', content: part.slice(1, -1) }
      }
      return { type: 'text', content: part }
    })
}

function renderInlineMarkdown(parts: Array<{ type: 'text' | 'bold' | 'italic'; content: string }>) {
  return parts.map((part, idx) => {
    const style = part.type === 'bold' ? { fontWeight: 700 as const } : part.type === 'italic' ? { fontStyle: 'italic' as const } : {}
    return (
      <Text key={idx} style={style as any}>
        {part.content}
      </Text>
    )
  })
}

function getHeadingStyle(level: 1 | 2 | 3, align?: 'left' | 'center' | 'right') {
  let base = level === 1 ? styles.heading1 : level === 2 ? styles.heading2 : styles.heading3
  return {
    ...base,
    textAlign: align || 'left'
  }
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

function renderBlock(block: Block, context: RenderContext, style?: Record<string, unknown>): React.ReactElement {
  switch (block.type) {
    case 'heading': {
      const resolved = resolveTemplate(context, block.text)
      const headingStyle = getHeadingStyle(block.level, block.align)
      return (
        <Text key={block.id} style={{ ...headingStyle, color: (style?.primaryColor as string) || '#000' }}>
          {resolved}
        </Text>
      )
    }

    case 'text': {
      const resolved = resolveTemplate(context, block.content)
      const parts = parseInlineMarkdown(resolved)
      return (
        <Text key={block.id} style={{ ...styles.text, textAlign: block.align || 'left' }}>
          {renderInlineMarkdown(parts)}
        </Text>
      )
    }

    case 'field': {
      const label = block.label || getFieldLabel(context, block.col_key)
      const value = getFieldValue(context, block.col_key)

      if (block.layout === 'inline') {
        return (
          <View key={block.id} style={styles.fieldInline}>
            <Text style={styles.label}>{label}:</Text>
            <Text style={styles.fieldValue}>{value}</Text>
          </View>
        )
      }
      return (
        <View key={block.id} style={styles.fieldStacked}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.fieldValue}>{value}</Text>
        </View>
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
          <View
            key={block.id}
            style={{
              ...styles.imagePlaceholder,
              width: block.width || 200,
              height: block.height || 150,
              marginBottom: 8
            } as any}
          />
        )
      }

      const alignMap = { left: 'flex-start' as const, center: 'center' as const, right: 'flex-end' as const }
      return (
        <View key={block.id} style={{ marginBottom: 8, alignItems: alignMap[block.align || 'left'] } as any}>
          <Image src={source} style={{ width: block.width || 200, height: block.height || 150 }} />
        </View>
      )
    }

    case 'columns': {
      const childrenViews = block.children.map((col, idx) => {
        const colStyle: Record<string, unknown> = { gap: block.gap || 8 }

        if (col.width.endsWith('fr')) {
          colStyle.flex = parseInt(col.width.split('fr')[0])
        } else if (col.width.endsWith('%')) {
          colStyle.width = col.width
        } else {
          colStyle.width = col.width
        }

        return (
          <View key={idx} style={colStyle as any}>
            {col.blocks.map(childBlock => renderBlock(childBlock, context, style))}
          </View>
        )
      })

      return (
        <View key={block.id} style={{ flexDirection: 'row', gap: block.gap || 8, marginBottom: 8 } as any}>
          {childrenViews}
        </View>
      )
    }

    case 'spacer': {
      return <View key={block.id} style={{ height: block.height }} />
    }

    case 'divider': {
      return (
        <View
          key={block.id}
          style={{
            ...styles.divider,
            borderBottomWidth: block.thickness || 1,
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
          return <Text key={block.id}>{block.empty_text}</Text>
        }
        return <View key={block.id} />
      }

      const scope = block.source === 'sub_items' ? 'sub_item' : ('relation' as const)
      return (
        <View key={block.id}>
          {items.map((item: any) => {
            const itemContext = withRepeatScope(context, scope, item as any)
            return (
              <View key={item.id}>
                {block.blocks.map(childBlock => renderBlock(childBlock, itemContext, style))}
              </View>
            )
          })}
        </View>
      )
    }

    case 'subitems_table': {
      const columns = block.columns
      const columnMetas = columns.map(col_key =>
        context.subItemColumns.find(c => c.col_key === col_key) || { col_key, name: col_key, kind: 'text' as any }
      )

      return (
        <View key={block.id} style={styles.tableContainer}>
          <View style={{ ...styles.tableRow, ...styles.tableHeaderRow }}>
            {columnMetas.map(meta => (
              <Text key={meta.col_key} style={{ ...styles.tableCell, flex: 1 }}>
                {meta.name}
              </Text>
            ))}
          </View>
          {context.subItems.map(item => (
            <View key={item.id} style={styles.tableRow}>
              {columns.map(col_key => (
                <Text key={col_key} style={{ ...styles.tableCell, flex: 1 }}>
                  {item.values[col_key] ?? ''}
                </Text>
              ))}
            </View>
          ))}
          {block.show_totals && block.total_col_keys && block.total_col_keys.length > 0 && (
            <View style={styles.tableRow}>
              {columns.map(col_key => {
                if (block.total_col_keys?.includes(col_key)) {
                  const sum = context.subItems.reduce((acc, item) => {
                    const val = parseFloat(String(item.values[col_key] ?? 0))
                    return acc + (isNaN(val) ? 0 : val)
                  }, 0)
                  return (
                    <Text key={col_key} style={{ ...styles.tableCell, flex: 1, fontWeight: 'bold' }}>
                      {sum.toFixed(2)}
                    </Text>
                  )
                }
                return (
                  <Text key={col_key} style={{ ...styles.tableCell, flex: 1 }}>

                  </Text>
                )
              })}
            </View>
          )}
        </View>
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
        <View key={block.id} style={styles.totalContainer}>
          <Text style={styles.totalLabel}>{label}</Text>
          <Text style={styles.totalValue}>{displayValue}</Text>
        </View>
      )
    }

    case 'signature': {
      const sig = context.document?.signatures?.find(s => s.role === block.role)
      const roleLabel = block.label || `Firma de ${block.role}`

      if (sig && sig.image_url) {
        return (
          <View key={block.id} style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>{roleLabel}</Text>
            <Image src={sig.image_url} style={{ width: 100, height: 50, marginBottom: 8 }} />
            {sig.user_name && <Text style={styles.signatureName}>{sig.user_name}</Text>}
            {sig.signed_at && <Text style={{ fontSize: 9, color: '#9ca3af' }}>{sig.signed_at}</Text>}
          </View>
        )
      }

      return (
        <View key={block.id} style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>{roleLabel}</Text>
        </View>
      )
    }

    default: {
      const _exhaustive: never = block
      return <View key={(block as any).id} />
    }
  }
}

export function DocumentPdf({
  blocks,
  context,
  style
}: {
  blocks: Block[]
  context: RenderContext
  style?: Record<string, unknown>
}): React.ReactElement {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {style && (style.logo_url as string) && (
          <View style={{ marginBottom: 16 }}>
            <Image src={style.logo_url as string} style={{ width: 60, height: 60 }} />
          </View>
        )}
        {blocks.map(block => renderBlock(block, context, style))}
      </Page>
    </Document>
  )
}
