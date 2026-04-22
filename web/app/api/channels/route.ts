import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return jsonError('itemId required', 400)

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('item_channels')
    .select('id, name, type, visibility, team_id, position, created_at, channel_members(user_id)')
    .eq('item_id', itemId)
    .eq('workspace_id', auth.workspaceId)
    .order('position')

  if (error) return jsonError(error.message, 500)

  const channels = (data ?? []).map((channel: any) => {
    const members = (channel.channel_members as any[] | null)?.map(m => m.user_id) ?? []
    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      visibility: channel.visibility ?? 'public',
      team_id: channel.team_id,
      position: channel.position,
      created_at: channel.created_at,
      members,
      member_count: members.length,
    }
  })

  return NextResponse.json({ channels })
}

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const { item_id, name, type, visibility } = body as {
    item_id?: string
    name?: string
    type?: string
    visibility?: string
  }
  if (!item_id || !name) {
    return jsonError('item_id and name required', 400)
  }

  const channelVisibility = visibility === 'private' ? 'private' : 'public'
  const supabase = await createClient()

  const { data: last } = await supabase
    .from('item_channels')
    .select('position')
    .eq('item_id', item_id)
    .eq('workspace_id', auth.workspaceId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (last?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('item_channels')
    .insert({
      workspace_id: auth.workspaceId,
      item_id,
      name,
      type: type ?? 'internal',
      visibility: channelVisibility,
      position,
    })
    .select('id, name, type, visibility, team_id, position, created_at')
    .single()

  if (error) return jsonError(error.message, 500)

  // Auto-add creator as member on private channels so they retain access
  if (channelVisibility === 'private' && data) {
    await supabase.from('channel_members').insert({
      channel_id: data.id,
      user_id: auth.userId,
      added_by: auth.userId,
    })
  }

  return NextResponse.json({ ...data, members: channelVisibility === 'private' ? [auth.userId] : [] }, { status: 201 })
}
