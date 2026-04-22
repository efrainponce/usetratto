import type { Block } from './types'

/**
 * Configuración de una plantilla de cotización.
 * Se guarda en `document_templates.style_json.quote_config` y el editor regenera
 * `body_json` en cada cambio — fuente única de verdad para lo que ve el usuario.
 */
export interface QuoteConfig {
  /** col_keys del sub_item_view "Catálogo" a incluir en la tabla de productos. */
  tableColumns:         string[]
  /** Mostrar miniatura placeholder a la izquierda de cada fila (útil sin columna foto). */
  showThumbnail:        boolean
  /** Tasa de IVA (0.16 = 16%). Si es 0 → no se muestra la fila de IVA. */
  ivaRate:              number
  /** Texto libre al final del documento (términos, notas). Vacío = sección oculta. */
  notes:                string
  showClientSignature:  boolean
  showVendorSignature:  boolean
}

export const DEFAULT_QUOTE_CONFIG: QuoteConfig = {
  tableColumns:        ['sku', 'descripcion', 'cantidad', 'unidad', 'unit_price', 'subtotal'],
  showThumbnail:       true,
  ivaRate:             0.16,
  notes:               '',
  showClientSignature: true,
  showVendorSignature: true,
}

/**
 * Construye el body_json de la plantilla a partir de la config.
 * Estructura fija: encabezado → Para → tabla productos → total → notas? → firmas.
 */
export function buildQuoteBody(config: QuoteConfig = DEFAULT_QUOTE_CONFIG): Block[] {
  const blocks: Block[] = [
    // ── Header row: logo/workspace + folio + fecha ──────────────────────────
    {
      id: 'header-row',
      type: 'columns',
      gap: 24,
      children: [
        {
          width: '60%',
          blocks: [
            { id: 'logo-text', type: 'heading', level: 1, text: '{{workspace.name}}' },
          ],
        },
        {
          width: '40%',
          blocks: [
            { id: 'meta-folio', type: 'text', content: 'Cotización · **{{folio}}**', align: 'right' },
            { id: 'meta-fecha', type: 'text', content: 'Fecha: {{created_at|date}}', align: 'right' },
          ],
        },
      ],
    },
    { id: 'div-header', type: 'divider', thickness: 2 },
    { id: 'sp-header',  type: 'spacer',  height: 20 },

    // ── Para ────────────────────────────────────────────────────────────────
    { id: 'para-label', type: 'text',    content: 'Para' },
    { id: 'para-name',  type: 'heading', level: 2, text: '{{institucion.nombre}}' },
    { id: 'para-att',   type: 'text',    content: 'Att: {{contacto.nombre}}' },
    { id: 'sp-para',    type: 'spacer',  height: 24 },

    // ── Tabla de productos ──────────────────────────────────────────────────
    {
      id: 'items-table',
      type: 'subitems_table',
      columns: config.tableColumns,
      show_thumbnail: config.showThumbnail,
      column_configs: config.tableColumns.map(col_key => columnConfigFor(col_key)),
      show_totals: false,
    },
    { id: 'sp-table', type: 'spacer', height: 16 },

    // ── Subtotal / IVA / Total ──────────────────────────────────────────────
    {
      id: 'quote-totals',
      type: 'quote_totals',
      subtotal_col_key: 'subtotal',
      iva_rate: config.ivaRate,
    },
  ]

  // ── Notas (opcional) ──────────────────────────────────────────────────────
  if (config.notes && config.notes.trim()) {
    blocks.push(
      { id: 'sp-notes', type: 'spacer', height: 32 },
      { id: 'notes-label', type: 'heading', level: 3, text: 'Notas' },
      { id: 'notes-body',  type: 'text',    content: config.notes },
    )
  }

  // ── Firmas ────────────────────────────────────────────────────────────────
  const hasSignatures = config.showClientSignature || config.showVendorSignature
  if (hasSignatures) {
    blocks.push({ id: 'sp-sig', type: 'spacer', height: 56 })

    if (config.showClientSignature) {
      blocks.push({
        id: 'sig-cliente',
        type: 'signature',
        role: 'cliente',
        label: 'Firma del cliente',
        required: true,
      })
    }
    if (config.showVendorSignature) {
      blocks.push({
        id: 'sig-vendedor',
        type: 'signature',
        role: 'vendedor',
        label: 'Firma del vendedor',
        auto_sign_by_owner: true,
      })
    }
  }

  return blocks
}

/** Alias de compatibilidad — callers existentes siguen funcionando. */
export function basicQuoteTemplateBody(): Block[] {
  return buildQuoteBody(DEFAULT_QUOTE_CONFIG)
}

/** Ancho/alineación por defecto para cada col_key conocida del catálogo. */
function columnConfigFor(col_key: string): { col_key: string; width?: 'auto' | 'sm' | 'md' | 'lg'; align?: 'left' | 'right' | 'auto' } {
  switch (col_key) {
    case 'foto':        return { col_key, width: 'md', align: 'left'  }
    case 'sku':         return { col_key, width: 'md', align: 'left'  }
    case 'descripcion': return { col_key, align: 'left' }
    case 'cantidad':    return { col_key, width: 'sm', align: 'right' }
    case 'unidad':      return { col_key, width: 'sm', align: 'left'  }
    case 'unit_price':  return { col_key, width: 'md', align: 'right' }
    case 'subtotal':    return { col_key, width: 'md', align: 'right' }
    default:            return { col_key }
  }
}
