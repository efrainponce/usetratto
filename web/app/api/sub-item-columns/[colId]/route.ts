import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Ctx = { params: Promise<{ colId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { colId } = await params
  const body = await req.json() as Partial<{
    name: string
    kind: string
    position: number
    is_hidden: boolean
    required: boolean
    settings: Record<string, unknown>
    source_col_key: string | null
  }>

  const supabase = createServiceClient()

  // Verify ownership via workspace check (serviceClient bypasses RLS)
  const { data: col } = await supabase
    .from('sub_item_columns')
    .select('id, board_id')
    .eq('id', colId)
    .single()

  if (!col) return jsonError('Not found', 404)

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', col.board_id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return jsonError('Unauthorized', 403)

  const allowed = ['name', 'kind', 'position', 'is_hidden', 'required', 'settings', 'source_col_key'] as const
  const patch: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) patch[k] = body[k]
  }

  if (Object.keys(patch).length === 0) {
    return jsonError('nothing to update', 400)
  }

  const { data, error } = await supabase
    .from('sub_item_columns')
    .update(patch)
    .eq('id', colId)
    .select('id, board_id, col_key, name, kind, position, is_hidden, required, settings, source_col_key')
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { colId } = await params
  const supabase = createServiceClient()

  // Verify ownership via workspace check (serviceClient bypasses RLS)
  const { data: col } = await supabase
    .from('sub_item_columns')
    .select('id, board_id')
    .eq('id', colId)
    .single()

  if (!col) return jsonError('Not found', 404)

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', col.board_id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return jsonError('Unauthorized', 403)

  const { error } = await supabase
    .from('sub_item_columns')
    .delete()
    .eq('id', colId)

  if (error) return jsonError(error.message, 500)
  return new NextResponse(null, { status: 204 })
}
