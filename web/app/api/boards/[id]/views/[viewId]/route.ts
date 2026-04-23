import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk, verifyBoardAccess } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string; viewId: string }> }

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, viewId } = await params
  const body = await req.json() as {
    name?: string
    position?: number
    is_default?: boolean
    config?: Record<string, unknown>
  }

  const supabase = await createClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Verify view belongs to board
  const { data: view } = await supabase
    .from('board_views')
    .select('id, is_default')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return jsonError('View not found', 404)

  // Validate name if provided
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return jsonError('Name must be a non-empty string', 400)
    }
    if (body.name.length > 50) {
      return jsonError('Name must be 50 characters or less', 400)
    }
  }

  // If setting as default, unset all other views first
  if (body.is_default === true) {
    const { error: unsetError } = await supabase
      .from('board_views')
      .update({ is_default: false })
      .eq('board_id', id)
      .neq('id', viewId)

    if (unsetError) return jsonError(unsetError.message, 500)
  }

  // Build update object
  const updateData: Record<string, any> = {}
  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.position !== undefined) updateData.position = body.position
  if (body.is_default !== undefined) updateData.is_default = body.is_default

  if (body.config !== undefined) {
    if (typeof body.config !== 'object' || body.config === null || Array.isArray(body.config)) {
      return jsonError('config must be an object', 400)
    }
    updateData.config = body.config
  }

  const { data: updated, error } = await supabase
    .from('board_views')
    .update(updateData)
    .eq('id', viewId)
    .select(`id, sid, name, is_default, position, config, created_at, board_view_columns(id, column_id, is_visible, position, width)`)
    .single()

  if (error) return jsonError(error.message, 500)
  return jsonOk(updated)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, viewId } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Verify view belongs to board and check if default
  const { data: view } = await supabase
    .from('board_views')
    .select('id, is_default')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return jsonError('View not found', 404)

  if (view.is_default) {
    return jsonError('No puedes eliminar la vista predeterminada', 400)
  }

  // Delete view
  const { error } = await supabase
    .from('board_views')
    .delete()
    .eq('id', viewId)

  if (error) return jsonError(error.message, 500)
  return jsonOk({ success: true })
}
