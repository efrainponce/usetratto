import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

type RawVal = { column_id: string; value_text: string | null; value_number: number | null; value_date: string | null; value_json: unknown }
type RawColumn = { id: string; col_key: string; name: string; kind: string; settings?: Record<string, unknown> | null }

/**
 * GET /api/document-templates/[id]/context
 * Returns template + board + board_columns + sub_item_columns + workspace.
 * Optional query param ?item_id=<uuid> — if provided, also returns the real
 * rootValues + subItems so the editor preview uses live data instead of dummies.
 */
export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const url = new URL(req.url)
  const itemId = url.searchParams.get('item_id')
  const service = createServiceClient()

  const { data: template, error: tplErr } = await service
    .from('document_templates')
    .select('id, sid, name, target_board_id, status, body_json, style_json, signature_config, pre_conditions, folio_format, created_at, updated_at')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (tplErr || !template) return jsonError('Template not found', 404)

  const [{ data: board }, { data: columns }, { data: subItemColumns }, { data: workspace }] = await Promise.all([
    service.from('boards')
      .select('id, name, sid, workspace_id')
      .eq('id', template.target_board_id)
      .maybeSingle(),
    service.from('board_columns')
      .select('id, col_key, name, kind, settings')
      .eq('board_id', template.target_board_id)
      .order('position', { ascending: true }),
    service.from('sub_item_columns')
      .select('id, col_key, name, kind, settings')
      .eq('board_id', template.target_board_id)
      .order('position', { ascending: true }),
    service.from('workspaces')
      .select('id, name')
      .eq('id', auth.workspaceId)
      .maybeSingle(),
  ])

  if (!board) return jsonError('Board not found', 404)

  // Optional: live data when item_id is passed
  let liveItem: {
    rootItem: { id: string; sid: number; name: string; values: Record<string, string | number | null> }
    subItems: Array<{ id: string; sid: number; name: string; values: Record<string, string | number | null> }>
  } | null = null

  if (itemId) {
    const { data: item } = await service
      .from('items')
      .select('id, sid, name, workspace_id, item_values(column_id, value_text, value_number, value_date, value_json)')
      .eq('id', itemId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle()

    if (item) {
      const rootValues = await flattenValues(service, (columns ?? []) as RawColumn[], (item.item_values ?? []) as RawVal[], auth.workspaceId)

      // Chain lookup: cargo + cuenta desde el contacto relacionado
      const contactoCol = (columns ?? []).find(c => c.col_key === 'contacto' && c.kind === 'relation')
      const contactoIv  = contactoCol ? (item.item_values ?? []).find((iv: RawVal) => iv.column_id === contactoCol.id) : null
      const contactoId  = contactoIv && typeof contactoIv.value_text === 'string' ? contactoIv.value_text : null
      if (contactoId) {
        const chain = await fetchContactChain(service, contactoId, auth.workspaceId)
        rootValues.cargo  = chain.cargo
        rootValues.cuenta = chain.cuenta
      }

      // Fetch sub_items of this item
      const { data: rawSubItems } = await service
        .from('sub_items')
        .select('id, sid, name, position, sub_item_values(column_id, value_text, value_number, value_date, value_json)')
        .eq('item_id', itemId)
        .eq('depth', 0)
        .order('position', { ascending: true })

      const subItems = await Promise.all(
        (rawSubItems ?? []).map(async si => ({
          id:     si.id,
          sid:    si.sid,
          name:   si.name,
          values: await flattenValues(service, (subItemColumns ?? []) as RawColumn[], (si.sub_item_values ?? []) as RawVal[], auth.workspaceId),
        }))
      )

      liveItem = {
        rootItem: { id: item.id, sid: item.sid, name: item.name, values: rootValues },
        subItems,
      }
    }
  }

  return jsonOk({
    template,
    board,
    columns: columns ?? [],
    subItemColumns: subItemColumns ?? [],
    workspace: workspace ?? { id: auth.workspaceId, name: 'Workspace' },
    liveItem,
  })
}

/**
 * Jala cargo (text) + cuenta (nombre del item relacionado) del contacto.
 * Regresa `{cargo, cuenta}` con null cuando no aplica.
 */
async function fetchContactChain(
  service: ReturnType<typeof createServiceClient>,
  contactId: string,
  workspaceId: string
): Promise<{ cargo: string | null; cuenta: string | null }> {
  const { data: contactsBoard } = await service
    .from('boards')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('system_key', 'contacts')
    .maybeSingle()
  if (!contactsBoard) return { cargo: null, cuenta: null }

  const { data: cols } = await service
    .from('board_columns')
    .select('id, col_key')
    .eq('board_id', contactsBoard.id)
    .in('col_key', ['cargo', 'cuenta'])

  const cargoColId  = cols?.find(c => c.col_key === 'cargo')?.id
  const cuentaColId = cols?.find(c => c.col_key === 'cuenta')?.id
  const ids         = [cargoColId, cuentaColId].filter(Boolean) as string[]
  if (!ids.length) return { cargo: null, cuenta: null }

  const { data: ivs } = await service
    .from('item_values')
    .select('column_id, value_text')
    .eq('item_id', contactId)
    .in('column_id', ids)

  let cargo: string | null = null
  let cuentaId: string | null = null
  for (const iv of ivs ?? []) {
    if (iv.column_id === cargoColId)  cargo    = iv.value_text ?? null
    if (iv.column_id === cuentaColId) cuentaId = iv.value_text ?? null
  }

  let cuenta: string | null = null
  if (cuentaId) {
    const { data: cuentaItem } = await service
      .from('items')
      .select('name')
      .eq('id', cuentaId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    cuenta = cuentaItem?.name ?? null
  }
  return { cargo, cuenta }
}

/**
 * Build { col_key → resolved value } from raw values; resolves relation → name, people → user name, select → label.
 */
async function flattenValues(
  service: ReturnType<typeof createServiceClient>,
  columns: RawColumn[],
  values: RawVal[],
  workspaceId: string
): Promise<Record<string, string | number | null>> {
  const out: Record<string, string | number | null> = {}
  const byColumnId = new Map(columns.map(c => [c.id, c]))

  for (const v of values) {
    const col = byColumnId.get(v.column_id)
    if (!col) continue
    const raw = v.value_text ?? v.value_number ?? v.value_date ?? null

    // image/file kinds store URLs en value_json como [{url, ...}] — aplanamos a primer URL string.
    if (col.kind === 'image' || col.kind === 'file') {
      const j = v.value_json
      let url: string | null = null
      if (Array.isArray(j) && j.length > 0) {
        const first = j[0]
        if (typeof first === 'object' && first !== null && 'url' in first && typeof (first as { url?: unknown }).url === 'string') {
          url = (first as { url: string }).url
        }
      } else if (typeof j === 'string') {
        url = j
      }
      out[col.col_key] = url
      continue
    }

    if (col.kind === 'relation' && typeof raw === 'string') {
      const { data: rel } = await service
        .from('items')
        .select('name')
        .eq('id', raw)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      out[col.col_key] = rel?.name ?? raw
    } else if (col.kind === 'people' && typeof raw === 'string') {
      const { data: u } = await service
        .from('users')
        .select('name')
        .eq('id', raw)
        .maybeSingle()
      out[col.col_key] = u?.name ?? raw
    } else if (col.kind === 'select' && typeof raw === 'string') {
      const opts = (col.settings?.options as Array<{ value: string; label: string }> | undefined) ?? []
      out[col.col_key] = opts.find(o => o.value === raw)?.label ?? raw
    } else {
      out[col.col_key] = typeof raw === 'string' || typeof raw === 'number' ? raw : null
    }
  }

  return out
}
