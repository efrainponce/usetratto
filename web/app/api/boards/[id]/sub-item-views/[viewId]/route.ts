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
    config?: Record<string, unknown>
  }

  const supabase = await createClient()

  // Verify board belongs to workspace and view belongs to board
  const { data: view } = await supabase
    .from('sub_item_views')
    .select('id, board_id')
    .eq('id', viewId)
    .single()

  if (!view) return jsonError('View not found', 404)

  if (view.board_id !== id) {
    return jsonError('View does not belong to this board', 400)
  }

  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Build patch object with only provided fields
  const allowed = ['name', 'position', 'config'] as const
  const patch: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) patch[k] = body[k]
  }

  if (Object.keys(patch).length === 0) {
    return jsonError('No fields to update', 400)
  }

  const { data: updated, error } = await supabase
    .from('sub_item_views')
    .update(patch)
    .eq('id', viewId)
    .select('id, sid, name, position, type, config, created_at')
    .single()

  if (error) return jsonError(error.message, 500)
  return jsonOk(updated)
}

export async function DELETE(_req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return jsonError('Acceso denegado', 403)
  }

  const { id, viewId } = await params
  const supabase = await createClient()

  // Verify view belongs to board and board belongs to this workspace
  const { data: view } = await supabase
    .from('sub_item_views')
    .select('id, board_id, workspace_id')
    .eq('id', viewId)
    .single()

  if (!view) return jsonError('View not found', 404)

  if (view.board_id !== id) {
    return jsonError('View does not belong to this board', 400)
  }

  if (view.workspace_id !== auth.workspaceId) {
    return jsonError('Unauthorized', 403)
  }

  // Delete the view — allowed even if it's the last one (UI shows empty state + "Agregar vista")
  const { error } = await supabase
    .from('sub_item_views')
    .delete()
    .eq('id', viewId)

  if (error) return jsonError(error.message, 500)
  return new NextResponse(null, { status: 204 })
}
