import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { userCanAccessItem, getColumnUserAccess } from '@/lib/permissions'
import type { SubItemData, SubItemValue } from '@/lib/boards/types'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { jsonError } from '@/lib/api-helpers'

type Context = { params: Promise<{ viewId: string }> }

// ─── GET /api/sub-item-views/[viewId]/data?itemId=uuid ───────────────────────

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { viewId } = await params
  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return jsonError('itemId required', 400)

  // Use user JWT only for workspace ownership check, then switch to service client
  // to bypass RLS on data tables (auth already validated above).
  const userClient = await createClient()
  const service = createServiceClient()

  const { data: view, error: viewError } = await userClient
    .from('sub_item_views')
    .select('id, board_id, workspace_id, type, config')
    .eq('id', viewId)
    .single()

  if (viewError || !view) return jsonError('View not found', 404)
  if (view.workspace_id !== auth.workspaceId) return jsonError('Unauthorized', 403)

  // 16.11 + 16.10: Verify item access before processing
  const canAccess = await userCanAccessItem(itemId, auth.userId, auth.workspaceId, auth.role)
  if (!canAccess) return jsonError('Forbidden', 403)

  const config = view.config as Record<string, unknown>

  switch (view.type) {
    case 'native':         return nativeHandler(service, view.board_id, itemId, config, viewId, auth.userId, auth.workspaceId, auth.role)
    case 'board_items':    return boardItemsHandler(service, config, itemId, auth.userId, auth.workspaceId, auth.role)
    case 'board_sub_items': return boardSubItemsHandler(service, config, itemId, auth.userId, auth.workspaceId, auth.role)
    default:               return jsonError('Unknown type', 400)
  }
}

// ─── native ───────────────────────────────────────────────────────────────────
// Returns own sub_items for the item — the "snapshot" side of the feature.
// config.source_board_id drives ProductPicker (snapshot mode) in the frontend.

async function nativeHandler(
  supabase: SupabaseClient,
  boardId: string,
  itemId: string,
  config: Record<string, unknown>,
  viewId: string,
  userId: string,
  workspaceId: string,
  role?: string
) {
  const sourceBoardId = config.source_board_id as string | undefined

  // Fetch all sub_items for this item — filter by view in TypeScript to avoid
  // fragile PostgREST nested-AND-within-OR syntax.
  const subItemsQuery = supabase
    .from('sub_items')
    .select('id, sid, parent_id, depth, name, position, source_item_id, view_id, sub_item_values(column_id, value_text, value_number, value_date, value_json)')
    .eq('item_id', itemId)
    .order('depth')
    .order('position')

  const [colRes, itemRes] = await Promise.all([
    supabase
      .from('sub_item_columns')
      .select('id, col_key, name, kind, position, is_hidden, required, settings, source_col_key, permission_mode')
      .eq('board_id', boardId)
      .eq('view_id', viewId)
      .eq('is_hidden', false)
      .order('position'),
    subItemsQuery,
  ])

  if (colRes.error) return jsonError(colRes.error.message, 500)
  if (itemRes.error) return jsonError(itemRes.error.message, 500)

  const columns = colRes.data ?? []
  const colKeyMap = Object.fromEntries(columns.map(c => [c.id, c.col_key]))

  // 16.5: Annotate user_access for each column using getColumnUserAccess
  const columnsWithAccess = await Promise.all(
    columns.map(async (col) => {
      const userAccess = await getColumnUserAccess(
        { type: 'sub_item', id: col.id },
        userId,
        workspaceId,
        role
      )
      return {
        ...col,
        user_access: userAccess,
      }
    })
  )

  // Filter out columns with no access (restricted without override)
  const visibleColumns = columnsWithAccess.filter(col => col.user_access !== null)

  // Isolate by view:
  //  - new items: view_id === viewId
  //  - legacy items (view_id null): fall back to source_item_id logic per view type
  const allRows = itemRes.data ?? []
  const rows = allRows.filter(r => {
    if (r.view_id === viewId) return true          // assigned to this view
    if (r.view_id !== null)  return false          // assigned to a different view
    // legacy (view_id null) — use source_item_id as signal
    return sourceBoardId ? r.source_item_id !== null : r.source_item_id === null
  })

  // Build L1 + children tree in one pass
  const l1Map: Record<string, SubItemData> = {}
  const l1: SubItemData[] = []

  for (const row of rows) {
    const item: SubItemData = {
      id: row.id, sid: row.sid, parent_id: row.parent_id,
      depth: row.depth, name: row.name, position: row.position,
      source_item_id:  row.source_item_id ?? null,
      source_item_sid:  null,
      source_board_sid: null,
      values: (row.sub_item_values ?? []).map(v => ({ ...(v as Omit<SubItemValue, 'col_key'>), col_key: colKeyMap[(v as { column_id: string }).column_id] ?? '' })),
      children: [],
    }
    if (row.depth === 0) { l1Map[row.id] = item; l1.push(item) }
    else if (row.depth === 1 && row.parent_id && l1Map[row.parent_id]) {
      l1Map[row.parent_id].children!.push(item)
    }
  }

  // Resolve source item SIDs for navigation links
  const sourceIds = [...new Set(rows.map(r => r.source_item_id).filter(Boolean))] as string[]
  if (sourceIds.length > 0) {
    const { data: sourceItems } = await supabase
      .from('items')
      .select('id, sid, board_id')
      .in('id', sourceIds)

    if (sourceItems?.length) {
      const boardIds = [...new Set(sourceItems.map(i => i.board_id))]
      const { data: sourceBoards } = await supabase
        .from('boards')
        .select('id, sid')
        .in('id', boardIds)

      const boardSidMap = Object.fromEntries((sourceBoards ?? []).map(b => [b.id, b.sid]))
      const srcMap = Object.fromEntries(sourceItems.map(i => [i.id, { item_sid: i.sid, board_sid: boardSidMap[i.board_id] ?? null }]))

      const patchSids = (items: SubItemData[]) => {
        for (const item of items) {
          if (item.source_item_id && srcMap[item.source_item_id]) {
            item.source_item_sid  = srcMap[item.source_item_id].item_sid
            item.source_board_sid = srcMap[item.source_item_id].board_sid
          }
          if (item.children && item.children.length) patchSids(item.children)
        }
      }
      patchSids(l1)
    }
  }

  // Resolve conditional_select options — follow source_item_id → source board column value → CSV split.
  // Shape: { [subItemId]: { [col_key]: string[] } }
  const conditionalCols = visibleColumns.filter(c => c.kind === 'conditional_select')
  const conditionalOptions: Record<string, Record<string, string[]>> = {}

  if (conditionalCols.length > 0) {
    const sourceIds2 = [...new Set(rows.map(r => r.source_item_id).filter(Boolean))] as string[]
    if (sourceIds2.length > 0) {
      const { data: sourceItems2 } = await supabase
        .from('items')
        .select('id, board_id')
        .in('id', sourceIds2)

      const srcBoardIds = [...new Set((sourceItems2 ?? []).map(s => s.board_id))]
      const srcKeys = [...new Set(
        conditionalCols
          .map(c => (c.settings as Record<string, unknown>)?.source_col_key as string | undefined)
          .filter((k): k is string => typeof k === 'string' && k.length > 0)
      )]

      if (srcBoardIds.length > 0 && srcKeys.length > 0) {
        const { data: bcs } = await supabase
          .from('board_columns')
          .select('id, board_id, col_key')
          .in('board_id', srcBoardIds)
          .in('col_key', srcKeys)

        const bcMap: Record<string, Record<string, string>> = {}
        for (const bc of (bcs ?? [])) {
          if (!bcMap[bc.board_id]) bcMap[bc.board_id] = {}
          bcMap[bc.board_id][bc.col_key] = bc.id
        }

        const srcColIds = [...new Set((bcs ?? []).map(c => c.id))]
        const valueByItemCol: Record<string, Record<string, string>> = {}
        if (srcColIds.length > 0) {
          const { data: ivs } = await supabase
            .from('item_values')
            .select('item_id, column_id, value_text')
            .in('item_id', sourceIds2)
            .in('column_id', srcColIds)
          for (const v of (ivs ?? [])) {
            if (v.value_text == null) continue
            if (!valueByItemCol[v.item_id]) valueByItemCol[v.item_id] = {}
            valueByItemCol[v.item_id][v.column_id] = v.value_text
          }
        }

        const itemBoardById: Record<string, string> = {}
        for (const s of (sourceItems2 ?? [])) itemBoardById[s.id] = s.board_id

        const annotateTree = (items: SubItemData[]) => {
          for (const item of items) {
            if (item.source_item_id) {
              const srcBoard = itemBoardById[item.source_item_id]
              if (srcBoard) {
                const byCol: Record<string, string[]> = {}
                for (const col of conditionalCols) {
                  const key = (col.settings as Record<string, unknown>)?.source_col_key as string | undefined
                  if (!key) continue
                  const srcColId = bcMap[srcBoard]?.[key]
                  if (!srcColId) continue
                  const raw = valueByItemCol[item.source_item_id]?.[srcColId]
                  if (!raw) continue
                  byCol[col.col_key] = raw.split(',').map(s => s.trim()).filter(Boolean)
                }
                if (Object.keys(byCol).length > 0) conditionalOptions[item.id] = byCol
              }
            }
            if (item.children && item.children.length) annotateTree(item.children)
          }
        }
        annotateTree(l1)
      }
    }
  }

  return NextResponse.json({ kind: 'native', columns: visibleColumns, items: l1, conditional_options: conditionalOptions })
}

// ─── board_items ──────────────────────────────────────────────────────────────
// REFERENCE mode: shows items from another board that point to the current item.
// Nothing is copied — data is always live from the source board.
// config: { source_board_id, relation_col_id }

async function boardItemsHandler(
  supabase: SupabaseClient,
  config: Record<string, unknown>,
  itemId: string,
  userId: string,
  workspaceId: string,
  role?: string
) {
  const sourceBoardId = config.source_board_id as string | undefined
  const relationColId = config.relation_col_id as string | undefined
  if (!sourceBoardId || !relationColId) {
    return jsonError('config requires source_board_id and relation_col_id', 400)
  }

  // Step 1 — parallel: source board columns + related item_ids
  const [colRes, relRes] = await Promise.all([
    supabase
      .from('board_columns')
      .select('id, col_key, name, kind, position, is_hidden, settings')
      .eq('board_id', sourceBoardId)
      .eq('is_hidden', false)
      .order('position'),
    supabase
      .from('item_values')
      .select('item_id')
      .eq('column_id', relationColId)
      .eq('value_text', itemId),
  ])

  if (colRes.error) return jsonError(colRes.error.message, 500)
  if (relRes.error) return jsonError(relRes.error.message, 500)

  const columns = colRes.data ?? []
  const relatedItemIds = (relRes.data ?? []).map(v => v.item_id)

  if (relatedItemIds.length === 0) {
    const { data: board } = await supabase.from('boards').select('name').eq('id', sourceBoardId).single()
    // 16.5: Add user_access to columns using getColumnUserAccess
    const columnsWithAccess = await Promise.all(
      columns.map(async (col) => {
        const userAccess = await getColumnUserAccess(
          { type: 'board', id: col.id },
          userId,
          workspaceId,
          role
        )
        return {
          ...col,
          user_access: userAccess,
        }
      })
    )
    const visibleColumns = columnsWithAccess.filter(col => col.user_access !== null)
    return NextResponse.json({ kind: 'board_items', source_board_id: sourceBoardId, source_board_name: board?.name ?? '', columns: visibleColumns, items: [] })
  }

  // Step 2 — parallel: source items + board name
  const [itemRes, boardRes] = await Promise.all([
    supabase
      .from('items')
      .select('id, sid, name, stage_id, position, item_values(column_id, value_text, value_number, value_date, value_json)')
      .in('id', relatedItemIds)
      .eq('board_id', sourceBoardId)
      .order('position'),
    supabase.from('boards').select('name, sid').eq('id', sourceBoardId).single(),
  ])

  if (itemRes.error) return jsonError(itemRes.error.message, 500)

  // 16.5: Add user_access to columns using getColumnUserAccess
  const columnsWithAccess = await Promise.all(
    columns.map(async (col) => {
      const userAccess = await getColumnUserAccess(
        { type: 'board', id: col.id },
        userId,
        workspaceId,
        role
      )
      return {
        ...col,
        user_access: userAccess,
      }
    })
  )

  const visibleColumns = columnsWithAccess.filter(col => col.user_access !== null)

  return NextResponse.json({
    kind: 'board_items',
    source_board_id: sourceBoardId,
    source_board_sid: boardRes.data?.sid ?? null,
    source_board_name: boardRes.data?.name ?? '',
    columns: visibleColumns,
    items: itemRes.data ?? [],
  })
}

// ─── board_sub_items ──────────────────────────────────────────────────────────
// REFERENCE mode: shows sub_items of items from another board related to current item.
// config: { source_board_id, relation_col_id }

async function boardSubItemsHandler(
  supabase: SupabaseClient,
  config: Record<string, unknown>,
  itemId: string,
  userId: string,
  workspaceId: string,
  role?: string
) {
  const sourceBoardId = config.source_board_id as string | undefined
  const relationColId = config.relation_col_id as string | undefined
  if (!sourceBoardId || !relationColId) {
    return jsonError('config requires source_board_id and relation_col_id', 400)
  }

  // Step 1 — parallel: sub_item_columns of source board + related item_ids
  const [colRes, relRes] = await Promise.all([
    supabase
      .from('sub_item_columns')
      .select('id, col_key, name, kind, position, is_hidden, required, settings, source_col_key, permission_mode')
      .eq('board_id', sourceBoardId)
      .eq('is_hidden', false)
      .order('position'),
    supabase
      .from('item_values')
      .select('item_id')
      .eq('column_id', relationColId)
      .eq('value_text', itemId),
  ])

  if (colRes.error) return jsonError(colRes.error.message, 500)
  if (relRes.error) return jsonError(relRes.error.message, 500)

  const columns = colRes.data ?? []
  const colKeyMap = Object.fromEntries(columns.map(c => [c.id, c.col_key]))
  const relatedItemIds = (relRes.data ?? []).map(v => v.item_id)

  if (relatedItemIds.length === 0) {
    // 16.5: Add user_access to columns using getColumnUserAccess
    const columnsWithAccess = await Promise.all(
      columns.map(async (col) => {
        const userAccess = await getColumnUserAccess(
          { type: 'sub_item', id: col.id },
          userId,
          workspaceId,
          role
        )
        return {
          ...col,
          user_access: userAccess,
        }
      })
    )
    const visibleColumns = columnsWithAccess.filter(col => col.user_access !== null)
    return NextResponse.json({ kind: 'board_sub_items', source_board_id: sourceBoardId, columns: visibleColumns, items: [] })
  }

  // Step 2 — fetch sub_items of related items
  const { data: subItems, error: subErr } = await supabase
    .from('sub_items')
    .select('id, sid, parent_id, depth, name, position, source_item_id, item_id, sub_item_values(column_id, value_text, value_number, value_date, value_json)')
    .in('item_id', relatedItemIds)
    .order('depth')
    .order('position')

  if (subErr) return jsonError(subErr.message, 500)

  // Build tree (grouped within each parent item)
  const l1Map: Record<string, SubItemData> = {}
  const l1: SubItemData[] = []

  for (const row of subItems ?? []) {
    const item: SubItemData = {
      id: row.id, sid: row.sid, parent_id: row.parent_id,
      depth: row.depth, name: row.name, position: row.position,
      source_item_id: row.source_item_id ?? null,
      source_item_sid: null,
      source_board_sid: null,
      values: (row.sub_item_values ?? []).map(v => ({ ...(v as Omit<SubItemValue, 'col_key'>), col_key: colKeyMap[(v as { column_id: string }).column_id] ?? '' })),
      children: [],
    }
    if (row.depth === 0) { l1Map[row.id] = item; l1.push(item) }
    else if (row.depth === 1 && row.parent_id && l1Map[row.parent_id]) {
      l1Map[row.parent_id].children!.push(item)
    }
  }

  // 16.5: Add user_access to columns using getColumnUserAccess
  const columnsWithAccess = await Promise.all(
    columns.map(async (col) => {
      const userAccess = await getColumnUserAccess(
        { type: 'sub_item', id: col.id },
        userId,
        workspaceId,
        role
      )
      return {
        ...col,
        user_access: userAccess,
      }
    })
  )

  const visibleColumns = columnsWithAccess.filter(col => col.user_access !== null)

  return NextResponse.json({ kind: 'board_sub_items', source_board_id: sourceBoardId, columns: visibleColumns, items: l1 })
}
