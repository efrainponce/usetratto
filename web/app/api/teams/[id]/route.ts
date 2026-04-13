import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id } = await context.params
  const body = await request.json()
  const { name } = body

  if (!name?.trim()) {
    return NextResponse.json(
      { error: 'Team name is required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Verify team belongs to workspace
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError || !team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    )
  }

  const { data, error } = await supabase
    .from('teams')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, sid, name')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id } = await context.params

  const supabase = createServiceClient()

  // Verify team belongs to workspace
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError || !team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
