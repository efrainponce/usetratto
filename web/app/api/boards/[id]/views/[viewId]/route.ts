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
    is_default?: boolean
  }

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
    .select('id, is_default')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  // Validate name if provided
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
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
  }

  // If setting as default, unset all other views first
  if (body.is_default === true) {
    const { error: unsetError } = await supabase
      .from('board_views')
      .update({ is_default: false })
      .eq('board_id', id)
      .neq('id', viewId)

    if (unsetError) return NextResponse.json({ error: unsetError.message }, { status: 500 })
  }

  // Build update object
  const updateData: Record<string, any> = {}
  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.position !== undefined) updateData.position = body.position
  if (body.is_default !== undefined) updateData.is_default = body.is_default

  const { data: updated, error } = await supabase
    .from('board_views')
    .update(updateData)
    .eq('id', viewId)
    .select(`id, sid, name, is_default, position, created_at, board_view_columns(id, column_id, is_visible, position, width)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: Context) {
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

  // Verify view belongs to board and check if default
  const { data: view } = await supabase
    .from('board_views')
    .select('id, is_default')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  if (view.is_default) {
    return NextResponse.json(
      { error: 'No puedes eliminar la vista predeterminada' },
      { status: 400 }
    )
  }

  // Delete view
  const { error } = await supabase
    .from('board_views')
    .delete()
    .eq('id', viewId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
