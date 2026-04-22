import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { NextResponse } from 'next/server'
import { requireBoardAdmin } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk, verifyBoardAccess } from '@/lib/api-helpers'
import { createPermissionHandlers } from '@/lib/column-permissions-handler'

type Context = { params: Promise<{ id: string; colId: string }> }

const permissionHandlers = createPermissionHandlers('column_id')

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const supabase = createServiceClient()

  // Verify board exists
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Verify column exists
  const { data: column } = await supabase
    .from('board_columns')
    .select('id')
    .eq('id', colId)
    .eq('board_id', id)
    .single()

  if (!column) return jsonError('Not found', 404)

  return permissionHandlers.GET(supabase, colId, auth.workspaceId)
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const body = await req.json() as {
    user_id?: string
    team_id?: string
    access?: string
  }

  const supabase = createServiceClient()

  // Verify board and column exist
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  const { data: column } = await supabase
    .from('board_columns')
    .select('id')
    .eq('id', colId)
    .eq('board_id', id)
    .single()

  if (!column) return jsonError('Column not found', 404)

  return permissionHandlers.POST(supabase, colId, auth.workspaceId, body)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const body = await req.json() as { perm_id?: string }

  const supabase = createServiceClient()

  // Verify board and column exist
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  const { data: column } = await supabase
    .from('board_columns')
    .select('id')
    .eq('id', colId)
    .eq('board_id', id)
    .single()

  if (!column) return jsonError('Column not found', 404)

  return permissionHandlers.DELETE(supabase, colId, auth.workspaceId, body.perm_id ?? '')
}
