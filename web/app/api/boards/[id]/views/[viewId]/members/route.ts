import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; viewId: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, viewId } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify view belongs to board
  const { data: view } = await supabase
    .from('board_views')
    .select('id')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  // Fetch members
  const { data: members, error: membersError } = await supabase
    .from('board_view_members')
    .select('id, view_id, user_id, team_id, created_at, users(id, sid, name), teams(id, sid, name)')
    .eq('view_id', viewId)

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  return NextResponse.json(members ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, viewId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

  const body = await req.json() as { user_id?: string; team_id?: string }

  // Validate exactly one of user_id/team_id
  const hasUserId = body.user_id !== undefined && body.user_id !== null
  const hasTeamId = body.team_id !== undefined && body.team_id !== null

  if (!hasUserId && !hasTeamId) {
    return NextResponse.json(
      { error: 'Either user_id or team_id must be provided' },
      { status: 400 }
    )
  }

  if (hasUserId && hasTeamId) {
    return NextResponse.json(
      { error: 'Only one of user_id or team_id can be provided' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Verify view belongs to board
  const { data: view } = await supabase
    .from('board_views')
    .select('id')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  // Insert member
  const { data: member, error } = await supabase
    .from('board_view_members')
    .insert({
      view_id: viewId,
      user_id: hasUserId ? body.user_id : null,
      team_id: hasTeamId ? body.team_id : null,
    })
    .select('id, view_id, user_id, team_id, created_at, users(id, sid, name), teams(id, sid, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(member, { status: 201 })
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, viewId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

  const body = await req.json() as { member_id?: string }

  // Validate member_id
  if (!body.member_id) {
    return NextResponse.json(
      { error: 'member_id is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Verify view belongs to board
  const { data: view } = await supabase
    .from('board_views')
    .select('id')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  // Delete member
  const { error } = await supabase
    .from('board_view_members')
    .delete()
    .eq('id', body.member_id)
    .eq('view_id', viewId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
