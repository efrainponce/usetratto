import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { NextResponse } from 'next/server'
import { requireBoardAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk, verifyBoardAccess } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  const { data: board, error } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key, description')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (error || !board) return jsonError('Not found', 404)

  const { data: stages } = await supabase
    .from('board_stages')
    .select('id, sid, name, color, position, is_closed')
    .eq('board_id', id)
    .order('position')

  return jsonOk({ ...board, stages: stages ?? [] })
}

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const body = await req.json() as Partial<{
    sub_items_source_board_id: string | null
    name: string
    type: string
    description: string
  }>

  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified
  const { board } = verified

  const patch: Record<string, unknown> = {}

  if ('sub_items_source_board_id' in body) {
    patch.sub_items_source_board_id = body.sub_items_source_board_id
  }

  if ('name' in body && body.name !== undefined) {
    if (!body.name?.trim()) {
      return jsonError('Board name cannot be empty', 400)
    }
    patch.name = body.name.trim()
  }

  if ('type' in body && body.type !== undefined) {
    if (!['pipeline', 'table'].includes(body.type)) {
      return jsonError("Type must be 'pipeline' or 'table'", 400)
    }
    patch.type = body.type
  }

  if ('description' in body && body.description !== undefined) {
    patch.description = body.description || null
  }

  if (Object.keys(patch).length === 0) {
    return jsonError('Nothing to update', 400)
  }

  const { data, error } = await supabase
    .from('boards')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, sid, slug, name, type, system_key, description')
    .single()

  if (error || !data) return jsonError('Update failed', 500)
  return jsonOk(data)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id, system_key')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return jsonError('Board not found', 404)

  // Verify not a system board (system_key IS NULL)
  if (board.system_key !== null) {
    return jsonError('No se puede eliminar un board de sistema', 403)
  }

  // Delete board
  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', id)

  if (error) return jsonError(error.message, 500)
  return jsonOk({ success: true })
}
