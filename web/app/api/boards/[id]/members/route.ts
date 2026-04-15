import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: members, error } = await supabase
    .from('board_members')
    .select(`
      id,
      access,
      restrict_to_own,
      user_id,
      team_id,
      users(id, sid, name),
      teams(id, sid, name)
    `)
    .eq('board_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(members ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

  const body = await req.json() as {
    user_id?: string
    team_id?: string
    access?: string
  }

  // Validate: exactly one of user_id or team_id
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

  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Insert member
  const { data: member, error } = await supabase
    .from('board_members')
    .insert({
      board_id: id,
      user_id: hasUserId ? body.user_id : null,
      team_id: hasTeamId ? body.team_id : null,
      access: body.access,
    })
    .select(`
      id,
      access,
      user_id,
      team_id,
      users(id, sid, name),
      teams(id, sid, name)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(member, { status: 201 })
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

  const body = await req.json() as { member_id?: string }

  if (!body.member_id?.trim()) {
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

  // Delete member
  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('id', body.member_id)
    .eq('board_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
