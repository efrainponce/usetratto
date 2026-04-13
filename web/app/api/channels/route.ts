import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('item_channels')
    .select('id, name, type, team_id, position, created_at, channel_members(count)')
    .eq('item_id', itemId)
    .eq('workspace_id', auth.workspaceId)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const channels = (data ?? []).map((channel: any) => ({
    id: channel.id,
    name: channel.name,
    type: channel.type,
    team_id: channel.team_id,
    position: channel.position,
    created_at: channel.created_at,
    member_count: (channel.channel_members as any)?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ channels })
}

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const { item_id, name, type } = body as { item_id?: string; name?: string; type?: string }
  if (!item_id || !name) {
    return NextResponse.json({ error: 'item_id and name required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get next position
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
      position,
    })
    .select('id, name, type, team_id, position, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
