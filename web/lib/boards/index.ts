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

// ─── Board resolution (cached 60s) ───────────────────────────────────────────

export const resolveBoardBySid = unstable_cache(
  async (sid: number, workspaceId: string) => {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('boards')
      .select('id, sid, slug, name, type, system_key')
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
  { revalidate: 60 }
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

// ─── Items ────────────────────────────────────────────────────────────────────

export async function getBoardItems(boardId: string, workspaceId: string) {
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
}

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
