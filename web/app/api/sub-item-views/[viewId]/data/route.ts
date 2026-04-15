import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { userCanAccessItem, getColumnUserAccess } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

type Context = { params: Promise<{ viewId: string }> }

// ─── Shared types ─────────────────────────────────────────────────────────────

type SubItemValue = {
  column_id: string
  value_text: string | null
  value_number: number | null
  value_date: string | null
  value_json: unknown
}

type SubItemData = {
  id: string
  sid: number
  parent_id: string | null
  depth: number
  name: string
  position: number
  source_item_id: string | null
  source_item_sid:  number | null
  source_board_sid: number | null
  values: Array<SubItemValue & { col_key: string }>
  children: SubItemData[]
}

// ─── GET /api/sub-item-views/[viewId]/data?itemId=uuid ───────────────────────

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { viewId } = await params
  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  // Use user JWT only for workspace ownership check, then switch to service client
  // to bypass RLS on data tables (auth already validated above).
  const userClient = await createClient()
  const service = createServiceClient()

  const { data: view, error: viewError } = await userClient
    .from('sub_item_views')
    .select('id, board_id, workspace_id, type, config')
    .eq('id', viewId)
    .single()

  if (viewError || !view) return NextResponse.json({ error: 'View not found' }, { status: 404 })
  if (view.workspace_id !== auth.workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  // 16.11 + 16.10: Verify item access before processing
  const canAccess = await userCanAccessItem(itemId, auth.userId, auth.workspaceId, auth.role)
  if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const config = view.config as Record<string, unknown>

  switch (view.type) {
    case 'native':         return nativeHandler(service, view.board_id, itemId, config, viewId, auth.userId, auth.workspaceId, auth.role)
    case 'board_items':    return boardItemsHandler(service, config, itemId, auth.userId, auth.workspaceId, auth.role)
    case 'board_sub_items': return boardSubItemsHandler(service, config, itemId, auth.userId, auth.workspaceId, auth.role)
    default:               return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
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

  if (colRes.error) return NextResponse.json({ error: colRes.error.message }, { status: 500 })
  if (itemRes.error) return NextResponse.json({ error: itemRes.error.message }, { status: 500 })

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
      values: (row.sub_item_values ?? []).map((v: SubItemValue) => ({ ...v, col_key: colKeyMap[v.column_id] ?? '' })),
      children: [],
    }
    if (row.depth === 0) { l1Map[row.id] = item; l1.push(item) }
    else if (row.depth === 1 && row.parent_id && l1Map[row.parent_id]) {
      l1Map[row.parent_id].children.push(item)
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
          if (item.children.length) patchSids(item.children)
        }
      }
      patchSids(l1)
    }
  }

  return NextResponse.json({ kind: 'native', columns: visibleColumns, items: l1 })
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
    return NextResponse.json({ error: 'config requires source_board_id and relation_col_id' }, { status: 400 })
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

  if (colRes.error) return NextResponse.json({ error: colRes.error.message }, { status: 500 })
  if (relRes.error) return NextResponse.json({ error: relRes.error.message }, { status: 500 })

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

  if (itemRes.error) return NextResponse.json({ error: itemRes.error.message }, { status: 500 })

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
    return NextResponse.json({ error: 'config requires source_board_id and relation_col_id' }, { status: 400 })
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

  if (colRes.error) return NextResponse.json({ error: colRes.error.message }, { status: 500 })
  if (relRes.error) return NextResponse.json({ error: relRes.error.message }, { status: 500 })

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

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })

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
      values: (row.sub_item_values ?? []).map((v: SubItemValue) => ({ ...v, col_key: colKeyMap[v.column_id] ?? '' })),
      children: [],
    }
    if (row.depth === 0) { l1Map[row.id] = item; l1.push(item) }
    else if (row.depth === 1 && row.parent_id && l1Map[row.parent_id]) {
      l1Map[row.parent_id].children.push(item)
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
