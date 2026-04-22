import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: channelId } = await params

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('channel_members')
    .select(
      'channel_id, user_id, added_by, created_at, users!channel_members_user_id_fkey(id, name, phone)'
    )
    .eq('channel_id', channelId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ members: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: channelId } = await params
  const body = await req.json()
  const { user_id } = body as { user_id?: string }

  if (!user_id) {
    return jsonError('user_id required', 400)
  }

  const supabase = await createClient()

  // Verify channel belongs to auth.workspaceId
  const { data: channel, error: channelError } = await supabase
    .from('item_channels')
    .select('id')
    .eq('id', channelId)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (channelError) return jsonError(channelError.message, 500)
  if (!channel) return jsonError('Channel not found', 404)

  // Upsert member to avoid duplicates
  const { data, error } = await supabase
    .from('channel_members')
    .upsert(
      {
        channel_id: channelId,
        user_id,
        added_by: auth.userId,
        workspace_id: auth.workspaceId,
      },
      { onConflict: 'channel_id,user_id' }
    )
    .select(
      'channel_id, user_id, added_by, created_at, users!channel_members_user_id_fkey(id, name, phone)'
    )
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: channelId } = await params
  const body = await req.json()
  const { user_id } = body as { user_id?: string }

  if (!user_id) {
    return jsonError('user_id required', 400)
  }

  const supabase = await createClient()

  // Verify channel belongs to auth.workspaceId
  const { data: channel, error: channelError } = await supabase
    .from('item_channels')
    .select('id')
    .eq('id', channelId)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (channelError) return jsonError(channelError.message, 500)
  if (!channel) return jsonError('Channel not found', 404)

  const { error } = await supabase
    .from('channel_members')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', user_id)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ success: true })
}
