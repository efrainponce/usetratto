import { requireAuthApi, isAuthError } from '@/lib/auth/api'
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

  // Get existing views
  const { data: views, error: viewsError } = await supabase
    .from('board_views')
    .select(`id, sid, name, is_default, position, created_at, board_view_columns(id, column_id, is_visible, position, width), board_view_members(id, user_id, team_id, users(id, sid, name), teams(id, sid, name))`)
    .eq('board_id', id)
    .order('position')

  if (viewsError) return NextResponse.json({ error: viewsError.message }, { status: 500 })

  // Auto-create "Default" view if none exist
  if (!views || views.length === 0) {
    const { data: newView, error: createError } = await supabase
      .from('board_views')
      .insert({
        board_id: id,
        workspace_id: auth.workspaceId,
        name: 'Default',
        is_default: true,
        position: 0,
      })
      .select(`id, sid, name, is_default, position, created_at, board_view_columns(id, column_id, is_visible, position, width), board_view_members(id, user_id, team_id, users(id, sid, name), teams(id, sid, name))`)
      .single()

    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })
    return NextResponse.json(newView ? [newView] : [])
  }

  return NextResponse.json(views ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as { name?: string }

  // Validate name
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json(
      { error: 'Name must be a non-empty string' },
      { status: 400 }
    )
  }

  if (body.name.length > 50) {
    return NextResponse.json(
      { error: 'Name must be 50 characters or less' },
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

  // Get max position
  const { data: lastView } = await supabase
    .from('board_views')
    .select('position')
    .eq('board_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (lastView?.position ?? -1) + 1

  // Insert view
  const { data: view, error } = await supabase
    .from('board_views')
    .insert({
      board_id: id,
      workspace_id: auth.workspaceId,
      name: body.name.trim(),
      is_default: false,
      position: nextPosition,
    })
    .select(`id, sid, name, is_default, position, created_at, board_view_columns(id, column_id, is_visible, position, width), board_view_members(id, user_id, team_id, users(id, sid, name), teams(id, sid, name))`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(view, { status: 201 })
}
