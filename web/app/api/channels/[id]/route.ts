import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('item_channels')
    .select('id, name, type, team_id, position, created_at')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json()
  const { name, position } = body as { name?: string; position?: number }

  const supabase = await createClient()

  // Verify channel belongs to auth.workspaceId and get current type
  const { data: channel, error: fetchError } = await supabase
    .from('item_channels')
    .select('type')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  // Cannot change type of 'system' channel
  if (channel.type === 'system' && body.type !== undefined) {
    return NextResponse.json({ error: 'Cannot change type of system channel' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (position !== undefined) updates.position = position

  const { data, error } = await supabase
    .from('item_channels')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, name, type, team_id, position, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  // Cannot delete 'system' type channels
  if (channel.type === 'system') {
    return NextResponse.json({ error: 'Cannot delete system channel' }, { status: 400 })
  }

  const { error } = await supabase
    .from('item_channels')
    .delete()
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
