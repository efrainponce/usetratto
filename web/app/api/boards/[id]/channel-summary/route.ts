import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: boardId } = await params
  const supabase = createServiceClient()

  const { data: channels, error } = await supabase
    .from('item_channels')
    .select('id, item_id, items!inner(board_id, workspace_id)')
    .eq('items.board_id', boardId)
    .eq('items.workspace_id', auth.workspaceId)

  if (error) return jsonError(error.message, 500)

  const channelIds = (channels ?? []).map(c => c.id)
  const channelToItem: Record<string, string> = {}
  for (const c of channels ?? []) channelToItem[c.id] = c.item_id

  const perItem: Record<string, { message_count: number }> = {}

  if (channelIds.length > 0) {
    const { data: messages, error: mErr } = await supabase
      .from('channel_messages')
      .select('channel_id')
      .in('channel_id', channelIds)

    if (mErr) return jsonError(mErr.message, 500)

    for (const m of messages ?? []) {
      const itemId = channelToItem[m.channel_id]
      if (!itemId) continue
      perItem[itemId] ??= { message_count: 0 }
      perItem[itemId].message_count += 1
    }
  }

  return NextResponse.json({ items: perItem })
}
