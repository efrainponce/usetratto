import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export async function resolveBoardBySlug(slug: string, workspaceId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key')
    .eq('workspace_id', workspaceId)
    .eq('slug', slug)
    .single()
  return data ?? null
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
