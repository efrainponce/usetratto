import type { BoardColumnMeta, ResolvedValue, RenderContext } from './types'

/**
 * Genera un RenderContext con datos dummy para preview de templates
 */
export function buildSampleContext(
  rootColumns: BoardColumnMeta[],
  subItemColumns: BoardColumnMeta[],
  workspace: { id: string; name: string; logo_url?: string }
): RenderContext {
  // Build dummy root item values
  const rootValues: Record<string, ResolvedValue> = {}
  rootColumns.forEach((col) => {
    rootValues[col.col_key] = getDummyValue(col.kind as string)
  })
  // Garantizar que cuenta/contacto aparezcan en preview aunque no existan como columnas.
  if (!('cuenta'      in rootValues)) rootValues.cuenta      = 'Hospital General de México'
  if (!('contacto'    in rootValues)) rootValues.contacto    = 'Dra. María González'
  if (!('cargo'       in rootValues)) rootValues.cargo       = 'Directora de Compras'
  if (!('owner'       in rootValues)) rootValues.owner       = 'Angel Omar Canto Cural'

  // Build dummy sub-items
  const subItems = [
    { id: 'sub1', sid: 1, name: 'Sub-item 1', values: {} as Record<string, ResolvedValue> },
    { id: 'sub2', sid: 2, name: 'Sub-item 2', values: {} as Record<string, ResolvedValue> },
    { id: 'sub3', sid: 3, name: 'Sub-item 3', values: {} as Record<string, ResolvedValue> },
  ]

  // URLs públicas de picsum.photos (sin autenticación, cache-friendly) para thumbnails en preview.
  const sampleThumbs = [
    'https://picsum.photos/seed/tratto1/80',
    'https://picsum.photos/seed/tratto2/80',
    'https://picsum.photos/seed/tratto3/80',
  ]
  subItems.forEach((item, idx) => {
    subItemColumns.forEach((col) => {
      if (col.kind === 'image' || col.kind === 'file') {
        item.values[col.col_key] = sampleThumbs[idx % sampleThumbs.length]
      } else {
        item.values[col.col_key] = getDummyValue(col.kind as string)
      }
    })
    // Si no hay columna foto pero el template la pide, la inyectamos para que el preview muestre algo.
    if (!('foto' in item.values)) item.values.foto = sampleThumbs[idx % sampleThumbs.length]
  })

  return {
    rootItem: {
      id: 'root-demo',
      sid: 1001,
      name: 'Cliente Demo',
      values: rootValues,
    },
    rootColumns,
    subItems,
    subItemColumns,
    workspace: {
      name: workspace.name,
      logo_url: workspace.logo_url,
    },
    document: {
      folio:             'COT-2026-0001',
      created_at:        new Date().toISOString(),
      generated_by_name: 'Angel Omar Canto Cural',
    },
  }
}

function getDummyValue(kind: string): ResolvedValue {
  switch (kind) {
    case 'text':
      return 'Lorem ipsum dolor sit amet'
    case 'number':
      return 1234.56
    case 'date':
      return new Date().toISOString().split('T')[0]
    case 'select':
    case 'multiselect':
      return 'Opción 1'
    case 'people':
      return 'Nombre Usuario'
    case 'phone':
      return '+52 555 1234 5678'
    case 'email':
      return 'demo@ejemplo.com'
    case 'file':
      return null
    case 'relation':
      return 'Empresa Demo'
    case 'rollup':
      return 5000
    case 'formula':
      return 42
    case 'boolean':
      return 'Sí'
    case 'autonumber':
      return 1
    case 'button':
      return 'Botón'
    case 'signature':
      return 'Firma'
    case 'reflejo':
      return 'Valor'
    default:
      return ''
  }
}
