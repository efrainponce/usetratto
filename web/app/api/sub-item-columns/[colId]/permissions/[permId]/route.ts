import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { NextResponse } from 'next/server'
import { requireBoardAdmin, getBoardIdForSubItemColumn } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk, verifyBoardAccess } from '@/lib/api-helpers'
import { createPermissionHandlers } from '@/lib/column-permissions-handler'

type Context = { params: Promise<{ colId: string; permId: string }> }

const permissionHandlers = createPermissionHandlers('sub_item_column_id')

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { colId, permId } = await params
  const boardId = await getBoardIdForSubItemColumn(colId)
  if (!boardId) {
    return jsonError('Column not found', 404)
  }
  const isAdmin = await requireBoardAdmin(boardId, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const service = createServiceClient()

  // Verify ownership: sub_item_columns → board_id → boards.workspace_id
  const { data: subItemColumn } = await service
    .from('sub_item_columns')
    .select('id, board_id')
    .eq('id', colId)
    .single()

  if (!subItemColumn) return jsonError('Sub-item column not found', 404)

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(service, subItemColumn.board_id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  return permissionHandlers.DELETE(service, colId, auth.workspaceId, permId)
}
