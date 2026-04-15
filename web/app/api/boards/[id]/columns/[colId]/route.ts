import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; colId: string }> }

const VALID_KINDS = [
  'text','number','date','select','multiselect','people','boolean',
  'relation','phone','email','autonumber','url','file','button','signature','formula',
]

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

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

  // System columns: allow settings/is_hidden/position/required (config-only changes),
  // block name/kind changes (would break identity)
  const isSystem = !!column.is_system

  const patch: Record<string, unknown> = {}

  if ('name' in body && body.name !== undefined) {
    if (isSystem) return NextResponse.json({ error: 'No se puede renombrar una columna de sistema' }, { status: 403 })
    if (!body.name?.trim()) return NextResponse.json({ error: 'Column name cannot be empty' }, { status: 400 })
    patch.name = body.name.trim()
  }
  if ('is_hidden' in body && body.is_hidden !== undefined) patch.is_hidden = body.is_hidden
  if ('required'  in body && body.required  !== undefined) patch.required  = body.required
  if ('position'  in body && body.position  !== undefined) patch.position  = body.position
  if ('kind' in body && body.kind !== undefined) {
    if (isSystem) return NextResponse.json({ error: 'No se puede cambiar el tipo de una columna de sistema' }, { status: 403 })
    if (!VALID_KINDS.includes(body.kind)) return NextResponse.json({ error: 'Invalid column kind' }, { status: 400 })
    patch.kind = body.kind
  }
  if ('settings' in body && body.settings !== undefined) patch.settings = body.settings

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  // Validate uniqueness of role settings
  if (patch.settings && typeof patch.settings === 'object') {
    const settings = patch.settings as Record<string, unknown>
    const role = settings.role
    if (role === 'owner' || role === 'primary_stage' || role === 'end_date') {
      const { data: existing } = await svc
        .from('board_columns')
        .select('id, settings')
        .eq('board_id', id)
        .neq('id', colId)

      const conflicting = (existing ?? []).find((col: { id: string; settings?: any }) => {
        return col.settings?.role === role
      })

      if (conflicting) {
        return NextResponse.json({ error: 'Ya existe otra columna con este rol' }, { status: 409 })
      }
    }
  }

  const { data: updated, error } = await svc
    .from('board_columns')
    .update(patch)
    .eq('id', colId)
    .select('id, col_key, name, kind, position, is_system, is_hidden, required, settings')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, colId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo el admin del board puede realizar esta acción' }, { status: 403 })
  }

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
  return NextResponse.json({ success: true })
}
