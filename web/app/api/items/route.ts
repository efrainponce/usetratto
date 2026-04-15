import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const boardId = new URL(req.url).searchParams.get('boardId')
  if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })

  const idsParam = new URL(req.url).searchParams.get('ids')
  const format = new URL(req.url).searchParams.get('format')
  const idList = idsParam ? idsParam.split(',').filter(Boolean) : null

  const supabase = await createClient()

  // Check if this user has restrict_to_own for this board (non-admin members only)
  let restrictToOwn = false
  if (auth.role === 'member' || auth.role === 'viewer') {
    const { data: membership } = await supabase
      .from('board_members')
      .select('restrict_to_own')
      .eq('board_id', boardId)
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (membership?.restrict_to_own) restrictToOwn = true
  }

  let query = supabase
    .from('items')
    .select(
      'id, sid, name, stage_id, owner_id, territory_id, deadline, position,' +
      'item_values(column_id, value_text, value_number, value_date, value_json)'
    )
    .eq('board_id', boardId)
    .eq('workspace_id', auth.workspaceId)

  if (idList && idList.length > 0) {
    query = query.in('id', idList)
  }

  if (restrictToOwn) {
    query = query.eq('owner_id', auth.userId)
  }

  const { data, error } = await query.order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data ?? []) as Array<any & { sub_items_rollup?: Record<string, number | null> }>

  // Check if board has rollup columns
  const { data: rollupCols } = await supabase
    .from('board_columns')
    .select('col_key, settings')
    .eq('board_id', boardId)
    .eq('kind', 'rollup')

  if (rollupCols && rollupCols.length > 0 && items.length > 0) {
    // Use service client — sub_item_columns RLS subqueries through boards fail silently with user JWT
    const svc = createServiceClient()

    // Get sub_item_columns for col_key→id mapping + settings (needed for percent_done closed_values)
    const { data: subCols } = await svc
      .from('sub_item_columns')
      .select('id, col_key, settings')
      .eq('board_id', boardId)

    const colKeyMap: Record<string, string> = {}  // id → col_key
    for (const sc of subCols ?? []) colKeyMap[sc.id] = sc.col_key

    // Build a map of col_key → current closed option values (for percent_done)
    const closedValuesMap: Record<string, string[]> = {}
    for (const sc of subCols ?? []) {
      const opts = (sc.settings as Record<string, unknown>)?.options as { value: string; is_closed?: boolean }[] | undefined
      if (opts) closedValuesMap[sc.col_key] = opts.filter(o => o.is_closed).map(o => o.value)
    }

    // Fetch all L1 sub-items with their values for these items
    const itemIds = items.map(i => i.id)
    const { data: subItems } = await svc
      .from('sub_items')
      .select('id, item_id, sub_item_values(column_id, value_number, value_text)')
      .in('item_id', itemIds)
      .eq('depth', 0)

    // Group sub-items by item_id, transform values to { col_key, value_number, value_text }
    const subsByItem: Record<string, { values: { col_key: string; value_number: number | null; value_text: string | null }[] }[]> = {}
    for (const si of subItems ?? []) {
      if (!subsByItem[si.item_id]) subsByItem[si.item_id] = []
      subsByItem[si.item_id].push({
        values: (si.sub_item_values ?? []).map(v => ({
          col_key: colKeyMap[v.column_id] ?? '',
          value_number: v.value_number,
          value_text: v.value_text,
        }))
      })
    }

    // Compute rollups for each item
    const { computeRollup } = await import('@/lib/rollup-engine')
    for (const item of items) {
      const children = subsByItem[item.id] ?? []
      const rollup: Record<string, number | null> = {}
      for (const rc of rollupCols) {
        const cfg = rc.settings?.rollup_config as import('@/lib/rollup-engine').RollupConfig | undefined
        if (!cfg) { rollup[rc.col_key] = null; continue }
        // For percent_done: always use current is_closed options from source column (not stale saved closed_values)
        const effectiveCfg = cfg.aggregate === 'percent_done'
          ? { ...cfg, closed_values: closedValuesMap[cfg.source_col_key] ?? cfg.closed_values ?? [] }
          : cfg
        rollup[rc.col_key] = computeRollup(effectiveCfg, { values: [], children })
      }
      item.sub_items_rollup = rollup
    }
  }

  // Transform to col_values map if requested
  if (format === 'col_keys' && items.length > 0) {
    const { data: boardCols } = await supabase
      .from('board_columns')
      .select('id, col_key')
      .eq('board_id', boardId)

    const columnIdToKey: Record<string, string> = {}
    for (const col of boardCols ?? []) {
      columnIdToKey[col.id] = col.col_key
    }

    for (const item of items) {
      const colValues: Record<string, unknown> = {}
      for (const iv of item.item_values ?? []) {
        const colKey = columnIdToKey[iv.column_id]
        if (!colKey) continue
        const value = iv.value_text ?? iv.value_number ?? iv.value_date ?? iv.value_json
        if (value !== null && value !== undefined) {
          colValues[colKey] = value
        }
      }
      item.col_values = colValues
    }
  }

  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const { board_id, name } = body as { board_id?: string; name?: string }
  if (!board_id || !name) {
    return NextResponse.json({ error: 'board_id and name required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get next position
  const { data: last } = await supabase
    .from('items')
    .select('position')
    .eq('board_id', board_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (last?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('items')
    .insert({
      workspace_id: auth.workspaceId,
      board_id,
      name,
      owner_id: auth.userId,
      position,
    })
    .select('id, sid, name, stage_id, owner_id, territory_id, deadline, position')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Apply default_value from board_columns
  const svc = createServiceClient()
  const { data: cols } = await svc
    .from('board_columns')
    .select('id, col_key, kind, settings')
    .eq('board_id', board_id)
    .eq('is_system', false)

  const defaultInserts: {
    item_id: string; column_id: string;
    value_text?: string; value_number?: number; value_date?: string; value_json?: unknown
  }[] = []

  for (const col of cols ?? []) {
    const def = (col.settings as Record<string, unknown>)?.default_value
    if (def === null || def === undefined || def === '') continue
    const kind = col.kind as string
    const entry: typeof defaultInserts[number] = { item_id: data.id, column_id: col.id }
    if (kind === 'number' || kind === 'formula' || kind === 'rollup') {
      const n = typeof def === 'number' ? def : parseFloat(String(def))
      if (!isNaN(n)) entry.value_number = n
    } else if (kind === 'boolean') {
      entry.value_json = def === 'true' || def === true
    } else if (kind === 'date') {
      entry.value_date = String(def)
    } else {
      entry.value_text = String(def)
    }
    // Skip if nothing to insert
    if (entry.value_text === undefined && entry.value_number === undefined && entry.value_date === undefined && entry.value_json === undefined) continue
    defaultInserts.push(entry)
  }

  if (defaultInserts.length > 0) {
    await svc.from('item_values').insert(defaultInserts)
  }

  return NextResponse.json(data, { status: 201 })
}
