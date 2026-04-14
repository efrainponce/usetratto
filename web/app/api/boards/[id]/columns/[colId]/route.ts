import { requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

type Context = { params: Promise<{ id: string; colId: string }> }

const VALID_KINDS = [
  'text','number','date','select','multiselect','people','boolean',
  'relation','phone','email','autonumber','url','file','button','signature','formula',
]

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const body = await req.json() as {
    name?: string
    kind?: string
    is_hidden?: boolean
    required?: boolean
    position?: number
    settings?: Record<string, unknown>
  }

  const svc = createServiceClient()

  // Service client bypasses RLS for the ownership check
  const { data: board } = await svc
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const { data: column } = await svc
    .from('board_columns')
    .select('id, is_system')
    .eq('id', colId)
    .eq('board_id', id)
    .maybeSingle()

  if (!column) return NextResponse.json({ error: 'Column not found' }, { status: 404 })

  if (column.is_system) {
    return NextResponse.json({ error: 'Cannot modify system columns' }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}

  if ('name' in body && body.name !== undefined) {
    if (!body.name?.trim()) return NextResponse.json({ error: 'Column name cannot be empty' }, { status: 400 })
    patch.name = body.name.trim()
  }
  if ('is_hidden' in body && body.is_hidden !== undefined) patch.is_hidden = body.is_hidden
  if ('required'  in body && body.required  !== undefined) patch.required  = body.required
  if ('position'  in body && body.position  !== undefined) patch.position  = body.position
  if ('kind' in body && body.kind !== undefined) {
    if (!VALID_KINDS.includes(body.kind)) return NextResponse.json({ error: 'Invalid column kind' }, { status: 400 })
    patch.kind = body.kind
  }
  if ('settings' in body && body.settings !== undefined) patch.settings = body.settings

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data: updated, error } = await svc
    .from('board_columns')
    .update(patch)
    .eq('id', colId)
    .select('id, col_key, name, kind, position, is_system, is_hidden, required, settings')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('board-context', {})
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const svc = createServiceClient()

  const { data: board } = await svc
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const { data: column } = await svc
    .from('board_columns')
    .select('id, is_system')
    .eq('id', colId)
    .eq('board_id', id)
    .maybeSingle()

  if (!column) return NextResponse.json({ error: 'Column not found' }, { status: 404 })

  if (column.is_system) return NextResponse.json({ error: 'Cannot delete system columns' }, { status: 403 })

  const supabase = await createClient()
  const { error } = await supabase.from('board_columns').delete().eq('id', colId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('board-context', {})
  return NextResponse.json({ success: true })
}
