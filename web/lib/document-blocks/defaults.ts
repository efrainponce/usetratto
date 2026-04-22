import type { Block } from './types'

/**
 * Basic quote template body — used when creating a new template to avoid starting from scratch.
 *
 * Layout: header (logo + metadata) → divider → Para section → subitems table → total → signatures.
 * Placeholders: {{workspace.name}}, {{contacto.nombre}}, {{institucion.nombre}}, {{created_at|date}}, {{folio}}.
 */
export function basicQuoteTemplateBody(): Block[] {
  return [
    // Header row: workspace logo/name + cot metadata
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
            { id: 'meta-folio', type: 'text', content: 'Cotización · **{{folio}}**' },
            { id: 'meta-fecha', type: 'text', content: 'Fecha: {{created_at|date}}' },
            { id: 'meta-vig',   type: 'text', content: 'Vigencia: 30 días' },
          ],
        },
      ],
    },
    { id: 'div-header', type: 'divider', thickness: 2 },
    { id: 'sp-header',  type: 'spacer',  height: 20 },

    // Para section
    { id: 'para-label', type: 'text',    content: 'Para' },
    { id: 'para-name',  type: 'heading', level: 2, text: '{{institucion.nombre}}' },
    { id: 'para-att',   type: 'text',    content: 'Att: {{contacto.nombre}}' },
    { id: 'sp-para',    type: 'spacer',  height: 20 },

    // Products table
    {
      id: 'items-table',
      type: 'subitems_table',
      columns: ['name', 'sku', 'cantidad', 'unit_price', 'subtotal'],
      show_totals: false,
    },
    { id: 'sp-table', type: 'spacer', height: 16 },

    // Total
    {
      id: 'total-monto',
      type: 'total',
      source: 'rollup',
      col_key: 'monto',
      label: 'Total',
      format: 'money',
    },
    { id: 'sp-total', type: 'spacer', height: 56 },

    // Signatures
    {
      id: 'sig-cliente',
      type: 'signature',
      role: 'cliente',
      label: 'Firma del cliente',
      required: true,
    },
    {
      id: 'sig-vendedor',
      type: 'signature',
      role: 'vendedor',
      label: 'Firma del vendedor',
      auto_sign_by_owner: true,
    },
  ]
}
