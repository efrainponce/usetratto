import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; stageId: string }> }

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, stageId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

  const body = await req.json() as {
    name?: string
    color?: string
    position?: number
    is_closed?: boolean
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

  // Verify stage belongs to board
  const { data: stage } = await supabase
    .from('board_stages')
    .select('id')
    .eq('id', stageId)
    .eq('board_id', id)
    .single()

  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  // Build patch object
  const patch: Record<string, unknown> = {}

  if ('name' in body && body.name !== undefined) {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Stage name cannot be empty' }, { status: 400 })
    }
    patch.name = body.name.trim()
  }

  if ('color' in body && body.color !== undefined) {
    if (!body.color?.trim()) {
      return NextResponse.json({ error: 'Stage color cannot be empty' }, { status: 400 })
    }
    patch.color = body.color.trim()
  }

  if ('position' in body && body.position !== undefined) {
    patch.position = body.position
  }

  if ('is_closed' in body && body.is_closed !== undefined) {
    patch.is_closed = body.is_closed
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('board_stages')
    .update(patch)
    .eq('id', stageId)
    .select('id, sid, name, color, position, is_closed')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, stageId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
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

  // Verify stage belongs to board
  const { data: stage } = await supabase
    .from('board_stages')
    .select('id')
    .eq('id', stageId)
    .eq('board_id', id)
    .single()

  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  // Delete stage
  const { error } = await supabase
    .from('board_stages')
    .delete()
    .eq('id', stageId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
