import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { userCanAccessItem, getColumnUserAccess, userCanViewColumn } from '@/lib/permissions'
import type { SubItemData, SubItemValue } from '@/lib/boards/types'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type SubItemColumn = {
  id: string
  board_id: string
  col_key: string
  name: string
  kind: string
  position: number
  is_hidden: boolean
  required: boolean
  settings: Record<string, unknown>
  source_col_key: string | null
  permission_mode?: string
  user_access?: 'edit' | 'view' | null
}

export async function GET(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return jsonError('itemId required', 400)

  const userClient = await createClient()
  const service = createServiceClient()

  // Get item to verify ownership and get board_id
  const { data: item } = await userClient
    .from('items')
    .select('board_id')
    .eq('id', itemId)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!item) return jsonError('Not found', 404)

  // 16.9: Verify item access before fetching
  const canAccess = await userCanAccessItem(itemId, auth.userId, auth.workspaceId, auth.role)
  if (!canAccess) return jsonError('Forbidden', 403)

  // Get sub_item_columns for the board
  const { data: columns } = await service
    .from('sub_item_columns')
    .select('id, board_id, col_key, name, kind, position, is_hidden, required, settings, source_col_key, permission_mode')
    .eq('board_id', item.board_id)
    .order('position')

  // Get sub_items with their values
  const { data: subItems } = await service
    .from('sub_items')
    .select('id, sid, parent_id, depth, name, source_item_id, position')
    .eq('item_id', itemId)
    .eq('workspace_id', auth.workspaceId)
    .order('depth')
    .order('position')

  if (!subItems || subItems.length === 0) {
    return NextResponse.json({
      columns: columns ?? [],
      items: [],
    })
  }

  // Get sub_item_values for all sub_items
  const subItemIds = subItems.map(s => s.id)
  const { data: values } = await service
    .from('sub_item_values')
    .select('sub_item_id, column_id, value_text, value_number, value_date, value_json')
    .in('sub_item_id', subItemIds)

  // Build colIdToKey map
  const colIdToKey: Record<string, string> = {}
  if (columns) {
    for (const col of columns) {
      colIdToKey[col.id] = col.col_key
    }
  }

  // Group values by sub_item_id and add col_key
  const valuesBySubItemId: Record<string, SubItemValue[]> = {}
  if (values) {
    for (const v of values) {
      if (!valuesBySubItemId[v.sub_item_id]) {
        valuesBySubItemId[v.sub_item_id] = []
      }
      valuesBySubItemId[v.sub_item_id].push({
        column_id: v.column_id,
        col_key: colIdToKey[v.column_id] ?? '',
        value_text: v.value_text,
        value_number: v.value_number,
        value_date: v.value_date,
        value_json: v.value_json,
      })
    }
  }

  // Build response items
  const items: SubItemData[] = subItems.map(si => ({
    id: si.id,
    sid: si.sid,
    parent_id: si.parent_id,
    depth: si.depth,
    name: si.name,
    source_item_id: si.source_item_id,
    position: si.position,
    values: valuesBySubItemId[si.id] ?? [],
  }))

  // 16.5: Annotate user_access for each column using getColumnUserAccess
  const columnsWithAccess = await Promise.all(
    (columns ?? []).map(async (col) => {
      const userAccess = await getColumnUserAccess(
        { type: 'sub_item', id: col.id },
        auth.userId,
        auth.workspaceId,
        auth.role
      )
      return {
        ...col,
        user_access: userAccess,
      }
    })
  )

  // Filter out columns with no access (restricted without override)
  const visibleColumns = columnsWithAccess.filter(col => col.user_access !== null)

  return NextResponse.json({
    columns: visibleColumns,
    items,
  })
}

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await req.json() as {
    item_id: string
    name?: string
    parent_id?: string | null
    depth?: 0 | 1
    source_item_id?: string | null
    view_id?: string | null
  }

  if (!body.item_id) {
    return jsonError('item_id required', 400)
  }

  const userClient2 = await createClient()
  const service2 = createServiceClient()

  // Look up parent item to verify ownership
  const { data: item } = await userClient2
    .from('items')
    .select('board_id')
    .eq('id', body.item_id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!item) return jsonError('Item not found', 404)

  const boardId = item.board_id
  const depth = body.depth ?? 0
  const parentId = body.parent_id ?? null

  // Get board to check sub_items_source_board_id
  const { data: board } = await service2
    .from('boards')
    .select('sub_items_source_board_id')
    .eq('id', boardId)
    .single()

  // Determine final name
  let finalName = body.name
  if (!finalName && body.source_item_id) {
    const { data: sourceItem } = await service2
      .from('items')
      .select('name')
      .eq('id', body.source_item_id)
      .single()
    finalName = sourceItem?.name ?? 'Nuevo'
  }
  if (!finalName) {
    finalName = 'Nuevo'
  }

  // Get next position in same (item_id, depth, parent_id) group
  const { data: last } = await service2
    .from('sub_items')
    .select('position')
    .eq('item_id', body.item_id)
    .eq('depth', depth)
    .eq(parentId ? 'parent_id' : 'depth', parentId ?? depth)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (last?.position ?? -1) + 1

  // Insert sub_item
  const { data: subItem, error: insertError } = await service2
    .from('sub_items')
    .insert({
      workspace_id: auth.workspaceId,
      item_id: body.item_id,
      parent_id: parentId,
      depth,
      name: finalName,
      source_item_id: body.source_item_id ?? null,
      view_id: body.view_id ?? null,
      position,
    })
    .select('id, sid, parent_id, depth, name, source_item_id, position')
    .single()

  if (insertError || !subItem) {
    return jsonError(insertError?.message ?? 'Insert failed', 500)
  }

  // Snapshot logic: if source_item_id and source_board exists
  if (body.source_item_id && board?.sub_items_source_board_id) {
    // Get sub_item_columns with source_col_key for this view
    const colQuery = service2
      .from('sub_item_columns')
      .select('id, source_col_key')
      .eq('board_id', boardId)
      .not('source_col_key', 'is', null)
    if (body.view_id) colQuery.eq('view_id', body.view_id)
    const { data: sourceColumns } = await colQuery

    if (sourceColumns && sourceColumns.length > 0) {
      const sourceColKeys = sourceColumns
        .map(c => c.source_col_key)
        .filter((k): k is string => k !== null)

      // Get board_columns from source board
      const { data: boardCols } = await service2
        .from('board_columns')
        .select('id, col_key')
        .eq('board_id', board.sub_items_source_board_id)
        .in('col_key', sourceColKeys)

      if (boardCols && boardCols.length > 0) {
        // Build map: source_col_key → board_column.id
        const sourceColKeyToId: Record<string, string> = {}
        for (const bc of boardCols) {
          sourceColKeyToId[bc.col_key] = bc.id
        }

        // Get item_values from source item
        const boardColIds = boardCols.map(bc => bc.id)
        const { data: itemVals } = await service2
          .from('item_values')
          .select('column_id, value_text, value_number, value_date, value_json')
          .eq('item_id', body.source_item_id)
          .in('column_id', boardColIds)

        if (itemVals && itemVals.length > 0) {
          // Build map: board_column.id → item_value
          const valsByColId: Record<string, typeof itemVals[0]> = {}
          for (const v of itemVals) {
            valsByColId[v.column_id] = v
          }

          // 16.4: Cache permission checks per source board column
          const permissionCache: Record<string, boolean> = {}

          // Insert sub_item_values
          const toInsert = []
          for (const srcCol of sourceColumns) {
            if (!srcCol.source_col_key) continue
            const boardColId = sourceColKeyToId[srcCol.source_col_key]
            if (!boardColId) continue
            const val = valsByColId[boardColId]
            if (!val) continue

            // 16.4: Check if user can view this source board column
            if (!(boardColId in permissionCache)) {
              permissionCache[boardColId] = await userCanViewColumn(
                { type: 'board', id: boardColId },
                auth.userId,
                auth.workspaceId
              )
            }
            if (!permissionCache[boardColId]) {
              continue
            }

            toInsert.push({
              sub_item_id: subItem.id,
              column_id: srcCol.id,
              value_text: val.value_text,
              value_number: val.value_number,
              value_date: val.value_date,
              value_json: val.value_json,
            })
          }

          if (toInsert.length > 0) {
            await service2.from('sub_item_values').insert(toInsert)
          }
        }
      }
    }
  }

  // Fetch the created sub_item with its values
  const { data: columns } = await service2
    .from('sub_item_columns')
    .select('id, col_key')
    .eq('board_id', boardId)

  const colIdToKey: Record<string, string> = {}
  if (columns) {
    for (const col of columns) {
      colIdToKey[col.id] = col.col_key
    }
  }

  const { data: values } = await service2
    .from('sub_item_values')
    .select('column_id, value_text, value_number, value_date, value_json')
    .eq('sub_item_id', subItem.id)

  const itemValues: SubItemValue[] = (values ?? []).map(v => ({
    column_id: v.column_id,
    col_key: colIdToKey[v.column_id] ?? '',
    value_text: v.value_text,
    value_number: v.value_number,
    value_date: v.value_date,
    value_json: v.value_json,
  }))

  const result: SubItemData = {
    id: subItem.id,
    sid: subItem.sid,
    parent_id: subItem.parent_id,
    depth: subItem.depth,
    name: subItem.name,
    source_item_id: subItem.source_item_id,
    position: subItem.position,
    values: itemValues,
  }

  return NextResponse.json(result, { status: 201 })
}
