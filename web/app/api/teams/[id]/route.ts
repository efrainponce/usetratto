import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

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
    return jsonError('Team name is required', 400)
  }

  const supabase = await createClient()

  // Verify team belongs to workspace
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError || !team) {
    return jsonError('Team not found', 404)
  }

  const { data, error } = await supabase
    .from('teams')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, sid, name')
    .single()

  if (error) {
    return jsonError(error.message, 500)
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

  const supabase = await createClient()

  // Verify team belongs to workspace
  const { data: team, error: fetchError } = await supabase
    .from('teams')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError || !team) {
    return jsonError('Team not found', 404)
  }

  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', id)

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ success: true })
}
