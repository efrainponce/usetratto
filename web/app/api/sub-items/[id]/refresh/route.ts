import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { userCanAccessItem, userCanViewColumn } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  // 1. Load sub-item by id
  const { data: subItem } = await supabase
    .from('sub_items')
    .select('id, item_id, workspace_id, depth, source_item_id')
    .eq('id', id)
    .single()

  if (!subItem) {
    return jsonError('Sub-item not found', 404)
  }

  // 16.13: Verify workspace_id matches
  if (subItem.workspace_id !== auth.workspaceId) {
    return jsonError('Not found', 404)
  }

  // 16.10: Verify item access
  const canAccess = await userCanAccessItem(subItem.item_id, auth.userId, auth.workspaceId, auth.role)
  if (!canAccess) {
    return jsonError('Forbidden', 403)
  }

  // Check depth is 0
  if (subItem.depth !== 0) {
    return jsonError('Solo sub-items de profundidad 0 pueden refrescarse', 400)
  }

  // Check source_item_id is not null
  if (!subItem.source_item_id) {
    return jsonError('Sub-item sin fuente', 400)
  }

  // 2. Status check (locked guard)
  // Load parent item board_id
  const { data: parentItem } = await supabase
    .from('items')
    .select('board_id')
    .eq('id', subItem.item_id)
    .single()

  if (!parentItem) {
    return jsonError('Parent item not found', 404)
  }

  // Load board settings
  const { data: board } = await supabase
    .from('boards')
    .select('settings')
    .eq('id', parentItem.board_id)
    .single()

  if (!board) {
    return jsonError('Board not found', 404)
  }

  const boardSettings = board.settings as Record<string, unknown> || {}
  const statusSubColKey = boardSettings.status_sub_col_key as string | null

  // Status check: verify if sub-item is locked (is_closed)
  if (statusSubColKey) {
    // Find the status sub_item_column
    const { data: statusCol } = await supabase
      .from('sub_item_columns')
      .select('id, settings')
      .eq('col_key', statusSubColKey)
      .eq('board_id', parentItem.board_id)
      .maybeSingle()

    if (statusCol) {
      const { data: statusValue } = await supabase
        .from('sub_item_values')
        .select('value_text')
        .eq('sub_item_id', id)
        .eq('column_id', statusCol.id)
        .maybeSingle()

      if (statusValue?.value_text) {
        const opts = (statusCol.settings as Record<string, unknown>)?.options as
          { value: string; is_closed?: boolean }[] | undefined ?? []
        const selectedOpt = opts.find(o => o.value === statusValue.value_text)
        if (selectedOpt?.is_closed === true) {
          return NextResponse.json({ error: 'Sub-item terminado — no se puede refrescar', locked: true }, { status: 409 })
        }
      }
    }
  }

  // 3. Value refresh
  // Load sub_item_columns with source_col_key mapping
  const { data: subItemCols } = await supabase
    .from('sub_item_columns')
    .select('id, source_col_key')
    .eq('board_id', parentItem.board_id)
    .not('source_col_key', 'is', null)

  if (!subItemCols || subItemCols.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  // Load source item's board_id
  const { data: sourceItem } = await supabase
    .from('items')
    .select('board_id')
    .eq('id', subItem.source_item_id)
    .single()

  if (!sourceItem) {
    return jsonError('Source item not found', 404)
  }

  // For each sub_item_column with source_col_key, copy values
  let updated = 0

  // 16.4: Cache permission checks per source board column
  const permissionCache: Record<string, boolean> = {}

  for (const subItemCol of subItemCols) {
    const sourceColKey = subItemCol.source_col_key as string

    // Find board_column in source board
    const { data: sourceBoardCol } = await supabase
      .from('board_columns')
      .select('id')
      .eq('board_id', sourceItem.board_id)
      .eq('col_key', sourceColKey)
      .maybeSingle()

    if (!sourceBoardCol) {
      // Source column doesn't exist, skip
      continue
    }

    // 16.4: Check if user can view this source board column
    if (!(sourceBoardCol.id in permissionCache)) {
      permissionCache[sourceBoardCol.id] = await userCanViewColumn(
        { type: 'board', id: sourceBoardCol.id },
        auth.userId,
        auth.workspaceId
      )
    }
    if (!permissionCache[sourceBoardCol.id]) {
      continue
    }

    // Find item_value in source item
    const { data: sourceValue } = await supabase
      .from('item_values')
      .select('value_text, value_number, value_date, value_json')
      .eq('item_id', subItem.source_item_id)
      .eq('column_id', sourceBoardCol.id)
      .maybeSingle()

    // Upsert into sub_item_values
    const { error: upsertError } = await supabase
      .from('sub_item_values')
      .upsert(
        {
          sub_item_id: id,
          column_id: subItemCol.id,
          value_text: sourceValue?.value_text ?? null,
          value_number: sourceValue?.value_number ?? null,
          value_date: sourceValue?.value_date ?? null,
          value_json: sourceValue?.value_json ?? null,
        },
        { onConflict: 'sub_item_id,column_id' }
      )

    if (!upsertError) {
      updated++
    }
  }

  return NextResponse.json({ updated })
}
