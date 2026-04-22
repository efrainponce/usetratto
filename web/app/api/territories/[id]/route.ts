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
    return jsonError('Territory name is required', 400)
  }

  const supabase = await createClient()

  // Verify territory belongs to workspace
  const { data: territory, error: fetchError } = await supabase
    .from('territories')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError || !territory) {
    return jsonError('Territory not found', 404)
  }

  const { data, error } = await supabase
    .from('territories')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, sid, name, parent_id')
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

  // Verify territory belongs to workspace
  const { data: territory, error: fetchError } = await supabase
    .from('territories')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (fetchError || !territory) {
    return jsonError('Territory not found', 404)
  }

  const { error } = await supabase
    .from('territories')
    .delete()
    .eq('id', id)

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ success: true })
}
