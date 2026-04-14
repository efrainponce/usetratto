import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const boardId = new URL(req.url).searchParams.get('boardId')
  if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })

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
    // Get sub_item_columns for col_key→id mapping
    const { data: subCols } = await supabase
      .from('sub_item_columns')
      .select('id, col_key')
      .eq('board_id', boardId)

    const colKeyMap: Record<string, string> = {}  // id → col_key
    for (const sc of subCols ?? []) colKeyMap[sc.id] = sc.col_key

    // Fetch all L1 sub-items with their values for these items
    const itemIds = items.map(i => i.id)
    const { data: subItems } = await supabase
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
        const cfg = rc.settings?.rollup_config
        if (!cfg) { rollup[rc.col_key] = null; continue }
        rollup[rc.col_key] = computeRollup(
          cfg as import('@/lib/rollup-engine').RollupConfig,
          { values: [], children }
        )
      }
      item.sub_items_rollup = rollup
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
  return NextResponse.json(data, { status: 201 })
}
