import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin, getBoardIdForSubItemColumn } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ colId: string; permId: string }> }

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { colId, permId } = await params
  const boardId = await getBoardIdForSubItemColumn(colId)
  if (!boardId) {
    return NextResponse.json({ error: 'Column not found' }, { status: 404 })
  }
  const isAdmin = await requireBoardAdmin(boardId, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

  const service = createServiceClient()

  // Verify ownership: sub_item_columns → board_id → boards.workspace_id
  const { data: subItemColumn } = await service
    .from('sub_item_columns')
    .select('id, board_id')
    .eq('id', colId)
    .single()

  if (!subItemColumn) return NextResponse.json({ error: 'Sub-item column not found' }, { status: 404 })

  const { data: board } = await service
    .from('boards')
    .select('id')
    .eq('id', subItemColumn.board_id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const { error } = await service
    .from('column_permissions')
    .delete()
    .eq('id', permId)
    .eq('sub_item_column_id', colId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
