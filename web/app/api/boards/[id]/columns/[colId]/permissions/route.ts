import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; colId: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const supabase = await createClient()

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: column } = await supabase
    .from('board_columns')
    .select('id')
    .eq('id', colId)
    .eq('board_id', id)
    .single()

  if (!column) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: permissions, error } = await supabase
    .from('column_permissions')
    .select(`
      id,
      column_id,
      user_id,
      team_id,
      access,
      created_at,
      users(id, sid, name),
      teams(id, sid, name)
    `)
    .eq('column_id', colId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(permissions ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
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

  const supabase = await createClient()

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const { data: column } = await supabase
    .from('board_columns')
    .select('id')
    .eq('id', colId)
    .eq('board_id', id)
    .single()

  if (!column) return NextResponse.json({ error: 'Column not found' }, { status: 404 })

  const { data: permission, error } = await supabase
    .from('column_permissions')
    .insert({
      column_id: colId,
      user_id: hasUserId ? body.user_id : null,
      team_id: hasTeamId ? body.team_id : null,
      access: body.access,
    })
    .select(`
      id,
      column_id,
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

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const body = await req.json() as { perm_id?: string }

  if (!body.perm_id?.trim()) {
    return NextResponse.json(
      { error: 'perm_id is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const { data: column } = await supabase
    .from('board_columns')
    .select('id')
    .eq('id', colId)
    .eq('board_id', id)
    .single()

  if (!column) return NextResponse.json({ error: 'Column not found' }, { status: 404 })

  const { error } = await supabase
    .from('column_permissions')
    .delete()
    .eq('id', body.perm_id)
    .eq('column_id', colId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
