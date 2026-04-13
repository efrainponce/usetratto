import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  const { data: board, error } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key, description')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (error || !board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: stages } = await supabase
    .from('board_stages')
    .select('id, sid, name, color, position, is_closed')
    .eq('board_id', id)
    .order('position')

  return NextResponse.json({ ...board, stages: stages ?? [] })
}

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as Partial<{
    sub_items_source_board_id: string | null
    name: string
    type: string
    description: string
  }>

  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}

  if ('sub_items_source_board_id' in body) {
    patch.sub_items_source_board_id = body.sub_items_source_board_id
  }

  if ('name' in body && body.name !== undefined) {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Board name cannot be empty' }, { status: 400 })
    }
    patch.name = body.name.trim()
  }

  if ('type' in body && body.type !== undefined) {
    if (!['pipeline', 'table'].includes(body.type)) {
      return NextResponse.json({ error: "Type must be 'pipeline' or 'table'" }, { status: 400 })
    }
    patch.type = body.type
  }

  if ('description' in body && body.description !== undefined) {
    patch.description = body.description || null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('boards')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, sid, slug, name, type, system_key, description')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id, system_key')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Verify not a system board (system_key IS NULL)
  if (board.system_key !== null) {
    return NextResponse.json(
      { error: 'Cannot delete system boards' },
      { status: 403 }
    )
  }

  // Delete board
  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
