import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Shared types (import type-safe from client components) ──────────────────

export type BoardStage = {
  id:        string
  name:      string
  color:     string
  position:  number
  is_closed: boolean
}

export type BoardColumn = {
  id:        string
  col_key:   string
  name:      string
  kind:      string
  is_system: boolean
  position:  number
  is_hidden: boolean
  required:  boolean
  settings:  Record<string, unknown>
}

export type WorkspaceUser = {
  id:    string
  sid:   number
  name:  string | null
  phone: string | null
  role:  string
}

export type ItemValue = {
  column_id:    string
  value_text:   string | null
  value_number: number | null
  value_date:   string | null
  value_json:   unknown
}

export type BoardItem = {
  id:               string
  sid:              number
  name:             string
  stage_id:         string | null
  owner_id:         string | null
  territory_id:     string | null
  deadline:         string | null
  position:         number
  item_values:      ItemValue[]
  sub_items_count?: number    // L1 count for badge in BoardView
}

export type SubItemColumn = {
  id:             string
  board_id:       string
  col_key:        string
  name:           string
  kind:           string
  position:       number
  is_hidden:      boolean
  required:       boolean
  settings:       Record<string, unknown>
  source_col_key: string | null
}

// ─── Board resolution (cached 60s) ───────────────────────────────────────────

export const resolveBoardBySid = unstable_cache(
  async (sid: number, workspaceId: string) => {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('boards')
      .select('id, sid, slug, name, type, system_key, sub_items_source_board_id, workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('sid', sid)
      .maybeSingle()
    if (error) console.error('[resolveBoardBySid] error:', error, { sid, workspaceId })
    return data ?? null
  },
  ['board-by-sid'],
  { revalidate: 60 }
)

export const getFirstBoard = unstable_cache(
  async (workspaceId: string) => {
    const supabase = createServiceClient()
    const { data: opp } = await supabase
      .from('boards')
      .select('id, sid, slug, name, type, system_key')
      .eq('workspace_id', workspaceId)
      .eq('system_key', 'opportunities')
      .single()
    if (opp) return opp

    const { data: any } = await supabase
      .from('boards')
      .select('id, sid, slug, name, type, system_key')
      .eq('workspace_id', workspaceId)
      .limit(1)
      .single()
    return any ?? null
  },
  ['first-board'],
  { revalidate: 60 }
)

// ─── Item resolution ──────────────────────────────────────────────────────────

export async function resolveItemBySid(sid: number, boardId: string, workspaceId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('items')
    .select('id, sid')
    .eq('board_id', boardId)
    .eq('workspace_id', workspaceId)
    .eq('sid', sid)
    .maybeSingle()
  if (error) console.error('[resolveItemBySid] error:', error, { sid, boardId })
  return data ?? null
}

// ─── Board context (stages + columns, cached 60s) ────────────────────────────

export const getBoardContext = unstable_cache(
  async (boardId: string) => {
    const supabase = createServiceClient()
    const [stagesRes, colsRes] = await Promise.all([
      supabase
        .from('board_stages')
        .select('id, name, color, position, is_closed')
        .eq('board_id', boardId)
        .order('position'),
      supabase
        .from('board_columns')
        .select('id, col_key, name, kind, position, is_system, is_hidden, required, settings')
        .eq('board_id', boardId)
        .order('position'),
    ])
    return {
      stages:  (stagesRes.data ?? []) as BoardStage[],
      columns: (colsRes.data   ?? []) as BoardColumn[],
    }
  },
  ['board-context'],
  { revalidate: 60, tags: ['board-context'] }
)

// ─── Workspace users (cached 60s) ─────────────────────────────────────────────

export const getWorkspaceUsers = unstable_cache(
  async (workspaceId: string) => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('users')
      .select('id, sid, name, phone, role')
      .eq('workspace_id', workspaceId)
      .order('name')
    return (data ?? []) as WorkspaceUser[]
  },
  ['workspace-users'],
  { revalidate: 60 }
)

// ─── Catalog board (cached 60s) ───────────────────────────────────────────────

export const getCatalogBoard = unstable_cache(
  async (workspaceId: string) => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('boards')
      .select('id, sid')
      .eq('workspace_id', workspaceId)
      .eq('system_key', 'catalog')
      .maybeSingle()
    return data ?? null
  },
  ['catalog-board'],
  { revalidate: 60 }
)

// ─── Sub-item columns (cached 60s — changes rarely) ─────────────────────────

export const getSubItemColumns = unstable_cache(
  async (boardId: string): Promise<SubItemColumn[]> => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('sub_item_columns')
      .select('id, board_id, col_key, name, kind, position, is_hidden, required, settings, source_col_key')
      .eq('board_id', boardId)
      .eq('is_hidden', false)
      .order('position')
    return (data ?? []) as SubItemColumn[]
  },
  ['sub-item-columns'],
  { revalidate: 60 }
)

// ─── Items (cached 15s — changes frequently, short TTL until Realtime) ───────

export const getBoardItems = unstable_cache(
  async (boardId: string, workspaceId: string) => {
    const supabase = createServiceClient()

    // Main items query
    const { data, error } = await supabase
      .from('items')
      .select(
        'id, sid, name, stage_id, owner_id, territory_id, deadline, position,' +
        'item_values(column_id, value_text, value_number, value_date, value_json)'
      )
      .eq('board_id', boardId)
      .eq('workspace_id', workspaceId)
      .order('position')

    if (error) console.error('[getBoardItems] error:', error)
    const items = (data ?? []) as unknown as BoardItem[]

    if (items.length === 0) return items

    // Separate lightweight query for sub-item counts (L1 only)
    const itemIds = items.map(i => i.id)
    const { data: subData } = await supabase
      .from('sub_items')
      .select('item_id')
      .eq('workspace_id', workspaceId)
      .eq('depth', 0)
      .in('item_id', itemIds)

    // Build count map
    const countMap: Record<string, number> = {}
    for (const { item_id } of subData ?? []) {
      countMap[item_id] = (countMap[item_id] ?? 0) + 1
    }

    return items.map(i => ({ ...i, sub_items_count: countMap[i.id] ?? 0 }))
  },
  ['board-items'],
  { revalidate: 15 }
)

export async function getItemData(itemId: string, workspaceId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('items')
    .select(
      'id, sid, name, stage_id, owner_id, territory_id, deadline, position,' +
      'item_values(column_id, value_text, value_number, value_date, value_json)'
    )
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
    .single()
  return (data ?? null) as unknown as BoardItem | null
}

// ─── Sub-item views (view definitions — not the data) ────────────────────────

export type SubItemView = {
  id:       string
  sid:      number
  name:     string
  position: number
  type:     'native' | 'board_items' | 'board_sub_items'
  config:   Record<string, unknown>
}

export const getSubItemViews = unstable_cache(
  async (boardId: string, workspaceId: string): Promise<SubItemView[]> => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('sub_item_views')
      .select('id, sid, name, position, type, config')
      .eq('board_id', boardId)
      .order('position')

    if (data && data.length > 0) return data as SubItemView[]

    // Auto-create default native view (fallback — migration normally handles this)
    const { data: created } = await supabase
      .from('sub_item_views')
      .insert({ board_id: boardId, workspace_id: workspaceId, name: 'Sub-items', position: 0, type: 'native', config: {} })
      .select('id, sid, name, position, type, config')
      .single()

    return created ? [created as SubItemView] : []
  },
  ['sub-item-views'],
  { revalidate: 60 }
)

// ─── Board views ──────────────────────────────────────────────────────────────

export type BoardViewColumn = {
  id:        string
  column_id: string
  is_visible: boolean
  position:  number
  width:     number
}

export type BoardView = {
  id:         string
  sid:        number
  name:       string
  is_default: boolean
  position:   number
  columns:    BoardViewColumn[]
}

export const getBoardViews = unstable_cache(
  async (boardId: string, workspaceId: string): Promise<BoardView[]> => {
    const supabase = createServiceClient()
    const { data: existing } = await supabase
      .from('board_views')
      .select('id, sid, name, is_default, position, board_view_columns(id, column_id, is_visible, position, width)')
      .eq('board_id', boardId)
      .order('position')

    if (existing && existing.length > 0) {
      return existing.map(v => ({ ...v, columns: v.board_view_columns ?? [] }))
    }

    // Auto-create Default view (only runs once per board, then cached)
    const { data: created } = await supabase
      .from('board_views')
      .insert({ board_id: boardId, workspace_id: workspaceId, name: 'Default', is_default: true, position: 0 })
      .select('id, sid, name, is_default, position')
      .single()

    if (!created) return []
    return [{ ...created, columns: [] }]
  },
  ['board-views'],
  { revalidate: 60 }
)
