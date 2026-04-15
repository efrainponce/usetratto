import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin, getBoardIdForSubItemColumn } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ colId: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { colId } = await params
  const service = createServiceClient()

  // Verify ownership: sub_item_columns → board_id → boards.workspace_id
  const { data: subItemColumn } = await service
    .from('sub_item_columns')
    .select('id, board_id')
    .eq('id', colId)
    .single()

  if (!subItemColumn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: board } = await service
    .from('boards')
    .select('id')
    .eq('id', subItemColumn.board_id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: permissions, error } = await service
    .from('column_permissions')
    .select(`
      id,
      sub_item_column_id,
      user_id,
      team_id,
      access,
      created_at,
      users(id, sid, name),
      teams(id, sid, name)
    `)
    .eq('sub_item_column_id', colId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(permissions ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { colId } = await params
  const boardId = await getBoardIdForSubItemColumn(colId)
  if (!boardId) {
    return NextResponse.json({ error: 'Column not found' }, { status: 404 })
  }
  const isAdmin = await requireBoardAdmin(boardId, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

  const body = await req.json() as {
    user_id?: string
    team_id?: string
    access?: string
  }

  const hasUserId = body.user_id && body.user_id.trim()
  const hasTeamId = body.team_id && body.team_id.trim()

  if ((hasUserId && hasTeamId) || (!hasUserId && !hasTeamId)) {
    return NextResponse.json(
      { error: 'Must specify exactly one of user_id or team_id' },
      { status: 400 }
    )
  }

  if (!body.access || !['view', 'edit'].includes(body.access)) {
    return NextResponse.json(
      { error: "Access must be 'view' or 'edit'" },
      { status: 400 }
    )
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

  const { data: permission, error } = await service
    .from('column_permissions')
    .insert({
      sub_item_column_id: colId,
      user_id: hasUserId ? body.user_id : null,
      team_id: hasTeamId ? body.team_id : null,
      access: body.access,
    })
    .select(`
      id,
      sub_item_column_id,
      user_id,
      team_id,
      access,
      created_at,
      users(id, sid, name),
      teams(id, sid, name)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(permission, { status: 201 })
}
