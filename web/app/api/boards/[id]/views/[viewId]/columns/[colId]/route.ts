import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; viewId: string; colId: string }> }

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, viewId, colId } = await params
  const body = await req.json() as {
    is_visible?: boolean
    position?: number
    width?: number
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
    .select('id')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  // Build upsert data
  const upsertData = {
    view_id: viewId,
    column_id: colId,
    is_visible: body.is_visible ?? true,
    position: body.position ?? null,
    width: body.width ?? null,
  }

  const { data: updated, error } = await supabase
    .from('board_view_columns')
    .upsert(upsertData, { onConflict: 'view_id,column_id' })
    .select('id, column_id, is_visible, position, width')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
