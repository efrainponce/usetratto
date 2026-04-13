import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export async function resolveBoardBySid(sid: number, workspaceId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key')
    .eq('workspace_id', workspaceId)
    .eq('sid', sid)
    .maybeSingle()
  if (error) console.error('[resolveBoardBySid] error:', error, { sid, workspaceId })
  return data ?? null
}

export async function getFirstBoard(workspaceId: string) {
  const supabase = createServiceClient()
  // Try opportunities first
  const { data: opp } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key')
    .eq('workspace_id', workspaceId)
    .eq('system_key', 'opportunities')
    .single()
  if (opp) return opp
  // Fallback: any board
  const { data: any } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key')
    .eq('workspace_id', workspaceId)
    .limit(1)
    .single()
  return any ?? null
}

export async function getBoardItems(boardId: string, workspaceId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('items')
    .select(
      'id, sid, name, stage_id, owner_id, territory_id, deadline, position,' +
      'item_values(column_id, value_text, value_number, value_date, value_json)'
    )
    .eq('board_id', boardId)
    .eq('workspace_id', workspaceId)
    .order('position')
  return data ?? []
}
