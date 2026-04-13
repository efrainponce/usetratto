import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; viewId: string }> }

export async function PUT(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, viewId } = await params
  const body = await req.json() as {
    columns?: Array<{
      column_id: string
      is_visible: boolean
      position?: number
      width?: number
    }>
  }

  // Validate columns array
  if (!Array.isArray(body.columns)) {
    return NextResponse.json(
      { error: 'Columns must be an array' },
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

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify view belongs to board
  const { data: view } = await supabase
    .from('board_views')
    .select('id')
    .eq('id', viewId)
    .eq('board_id', id)
    .single()

  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 })

  // Upsert columns
  const upsertData = body.columns.map((col) => ({
    view_id: viewId,
    column_id: col.column_id,
    is_visible: col.is_visible,
    position: col.position ?? null,
    width: col.width ?? null,
  }))

  const { data: updated, error } = await supabase
    .from('board_view_columns')
    .upsert(upsertData, { onConflict: 'view_id,column_id' })
    .select('id, column_id, is_visible, position, width')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated ?? [])
}
