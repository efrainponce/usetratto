import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('item_channels')
    .select('id, name, type, visibility, team_id, position, created_at')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json()
  const { name, position, visibility } = body as { name?: string; position?: number; visibility?: string }

  const supabase = await createClient()

  // Verify channel belongs to auth.workspaceId and get current type
  const { data: channel, error: fetchError } = await supabase
    .from('item_channels')
    .select('type, visibility')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError) return jsonError(fetchError.message, 500)
  if (!channel) return jsonError('Channel not found', 404)

  // Cannot change type of 'system' channel
  if (channel.type === 'system' && body.type !== undefined) {
    return jsonError('Cannot change type of system channel', 400)
  }

  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (position !== undefined) updates.position = position
  if (visibility !== undefined) {
    if (visibility !== 'public' && visibility !== 'private') {
      return jsonError('visibility must be public or private', 400)
    }
    if (channel.type === 'system') {
      return jsonError('Cannot change visibility of system channel', 400)
    }
    updates.visibility = visibility
  }

  const { data, error } = await supabase
    .from('item_channels')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, name, type, visibility, team_id, position, created_at')
    .single()

  if (error) return jsonError(error.message, 500)

  // When switching public → private, seed the switcher as a member so they don't lock themselves out
  if (visibility === 'private' && channel.visibility !== 'private') {
    await supabase.from('channel_members').upsert(
      {
        channel_id: id,
        user_id: auth.userId,
        added_by: auth.userId,
      },
      { onConflict: 'channel_id,user_id' }
    )
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params

  const supabase = await createClient()

  // Verify channel belongs to auth.workspaceId and get type
  const { data: channel, error: fetchError } = await supabase
    .from('item_channels')
    .select('type')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError) return jsonError(fetchError.message, 500)
  if (!channel) return jsonError('Channel not found', 404)

  // Cannot delete 'system' type channels
  if (channel.type === 'system') {
    return jsonError('Cannot delete system channel', 400)
  }

  const { error } = await supabase
    .from('item_channels')
    .delete()
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ success: true })
}
