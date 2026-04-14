import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  if (view.board_id !== id) {
    return NextResponse.json({ error: 'View does not belong to this board' }, { status: 400 })
  }

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  // Build patch object with only provided fields
  const allowed = ['name', 'position', 'config'] as const
  const patch: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) patch[k] = body[k]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('sub_item_views')
    .update(patch)
    .eq('id', viewId)
    .select('id, sid, name, position, type, config, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { id, viewId } = await params
  const supabase = await createClient()

  // Verify view belongs to board and board belongs to this workspace
  const { data: view } = await supabase
    .from('sub_item_views')
    .select('id, board_id, workspace_id')
    .eq('id', viewId)
    .single()

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  if (view.board_id !== id) {
    return NextResponse.json({ error: 'View does not belong to this board' }, { status: 400 })
  }

  if (view.workspace_id !== auth.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Check that at least 1 other view exists
  const { data: otherViews, error: countError } = await supabase
    .from('sub_item_views')
    .select('id')
    .eq('board_id', id)
    .neq('id', viewId)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

  if (!otherViews || otherViews.length === 0) {
    return NextResponse.json(
      { error: 'Cannot delete the last sub-item view' },
      { status: 400 }
    )
  }

  // Delete the view
  const { error } = await supabase
    .from('sub_item_views')
    .delete()
    .eq('id', viewId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
