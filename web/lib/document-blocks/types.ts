import type { CellKind } from '@/components/data-table/types'

// ─── Base ───────────────────────────────────────────────────────────────────────

export interface BaseBlock {
  id: string
  type: string
}

// ─── Block variants ─────────────────────────────────────────────────────────────

export interface HeadingBlock extends BaseBlock {
  type: 'heading'
  level: 1 | 2 | 3
  text: string
  align?: 'left' | 'center' | 'right'
}

export interface TextBlock extends BaseBlock {
  type: 'text'
  content: string
  align?: 'left' | 'center' | 'right' | 'justify'
}

export interface FieldBlock extends BaseBlock {
  type: 'field'
  col_key: string
  label?: string
  layout?: 'inline' | 'stacked'
}

export interface ImageBlock extends BaseBlock {
  type: 'image'
  source: 'col' | 'url'
  col_key?: string
  url?: string
  width?: number
  height?: number
  fit?: 'contain' | 'cover'
  align?: 'left' | 'center' | 'right'
}

export interface ColumnsBlock extends BaseBlock {
  type: 'columns'
  children: Array<{
    width: string
    blocks: Block[]
  }>
  gap?: number
}

export interface SpacerBlock extends BaseBlock {
  type: 'spacer'
  height: number
}

export interface DividerBlock extends BaseBlock {
  type: 'divider'
  thickness?: number
  color?: string
}

export interface RepeatBlock extends BaseBlock {
  type: 'repeat'
  source: 'sub_items' | 'relation'
  source_col_key?: string
  blocks: Block[]
  empty_text?: string
}

export interface SubitemsTableBlock extends BaseBlock {
  type: 'subitems_table'
  columns: string[]
  column_configs?: Array<{
    col_key: string
    width?:  'auto' | 'sm' | 'md' | 'lg'
    /** Ancho relativo (1-100). Si está set, toma precedencia sobre `width` y se usa como `fr`. */
    width_pct?: number
    align?:  'left' | 'right' | 'auto'
  }>
  show_thumbnail?: boolean
  thumbnail_col_key?: string
  show_totals?: boolean
  total_col_keys?: string[]
}

export interface TotalBlock extends BaseBlock {
  type: 'total'
  source: 'rollup' | 'formula' | 'static'
  col_key?: string
  value?: number
  label?: string
  format?: 'money' | 'number' | 'percent'
}

export interface QuoteTotalsBlock extends BaseBlock {
  type: 'quote_totals'
  /** col_key del sub_item cuya suma = subtotal del documento. Típicamente 'subtotal'. */
  subtotal_col_key: string
  /** Tasa de IVA (0.16 = 16%). Si es 0 → no se muestra la fila de IVA. */
  iva_rate: number
}

export interface SignatureBlock extends BaseBlock {
  type: 'signature'
  role: string
  label?: string
  required?: boolean
  auto_sign_by_owner?: boolean
  /** Si true, omite el título "Firma de…" arriba. Usado cuando el nombre basta. */
  hide_label?: boolean
  /** Nombre a mostrar debajo de la línea cuando no hay firma capturada.
   *  `'owner'` → `rootItem.values.owner` (responsable del item).
   *  `'generated_by'` → usuario que generó el PDF.
   *  Otro string → se usa literal. */
  fallback_name?: 'generated_by' | 'owner' | string
}

// ─── Union ──────────────────────────────────────────────────────────────────────

export type Block =
  | HeadingBlock
  | TextBlock
  | FieldBlock
  | ImageBlock
  | ColumnsBlock
  | SpacerBlock
  | DividerBlock
  | RepeatBlock
  | SubitemsTableBlock
  | TotalBlock
  | QuoteTotalsBlock
  | SignatureBlock

export type BlockType = Block['type']

// ─── Template body ──────────────────────────────────────────────────────────────

export type TemplateBody = Block[]

// ─── Document-level fields ──────────────────────────────────────────────────────

export interface DocumentMeta {
  folio?: string | null
  created_at?: string
  generated_by_name?: string
  signatures?: Array<{
    role: string
    user_id?: string
    user_name?: string
    signed_at: string
    image_url?: string
    ip?: string
  }>
}

// ─── Resolved value ─────────────────────────────────────────────────────────────

export type ResolvedValue = string | number | null

// ─── Board column metadata ──────────────────────────────────────────────────────

export interface BoardColumnMeta {
  col_key: string
  name: string
  kind: CellKind
  settings?: Record<string, unknown>
}

// ─── Render context ─────────────────────────────────────────────────────────────

export interface RenderContext {
  rootItem: {
    id: string
    sid: number
    name: string
    values: Record<string, ResolvedValue>
  }
  rootColumns: BoardColumnMeta[]

  subItems: Array<{
    id: string
    sid: number
    name: string
    values: Record<string, ResolvedValue>
  }>
  subItemColumns: BoardColumnMeta[]

  relationItems?: Record<string, Array<{ id: string; name: string; values: Record<string, ResolvedValue> }>>

  workspace: { name: string; logo_url?: string }
  document?: DocumentMeta

  current?: {
    scope: 'sub_item' | 'relation'
    item: { id: string; name: string; values: Record<string, ResolvedValue> }
  }
}
