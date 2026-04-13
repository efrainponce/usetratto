import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; colId: string }> }

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const body = await req.json() as {
    name?: string
    is_hidden?: boolean
    required?: boolean
    position?: number
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

  // Verify column belongs to board and is not system
  const { data: column } = await supabase
    .from('board_columns')
    .select('id, is_system')
    .eq('id', colId)
    .eq('board_id', id)
    .single()

  if (!column) return NextResponse.json({ error: 'Column not found' }, { status: 404 })

  if (column.is_system) {
    return NextResponse.json(
      { error: 'Cannot modify system columns' },
      { status: 403 }
    )
  }

  // Build patch object
  const patch: Record<string, unknown> = {}

  if ('name' in body && body.name !== undefined) {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Column name cannot be empty' }, { status: 400 })
    }
    patch.name = body.name.trim()
  }

  if ('is_hidden' in body && body.is_hidden !== undefined) {
    patch.is_hidden = body.is_hidden
  }

  if ('required' in body && body.required !== undefined) {
    patch.required = body.required
  }

  if ('position' in body && body.position !== undefined) {
    patch.position = body.position
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('board_columns')
    .update(patch)
    .eq('id', colId)
    .select('id, col_key, name, kind, position, is_system, is_hidden, required, settings')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Verify column belongs to board and is not system
  const { data: column } = await supabase
    .from('board_columns')
    .select('id, is_system')
    .eq('id', colId)
    .eq('board_id', id)
    .single()

  if (!column) return NextResponse.json({ error: 'Column not found' }, { status: 404 })

  if (column.is_system) {
    return NextResponse.json(
      { error: 'Cannot delete system columns' },
      { status: 403 }
    )
  }

  // Delete column (cascade delete item_values)
  const { error } = await supabase
    .from('board_columns')
    .delete()
    .eq('id', colId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
