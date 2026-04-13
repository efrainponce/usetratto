import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { data: board, error } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (error || !board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: stages } = await supabase
    .from('board_stages')
    .select('id, name, color, position, is_closed')
    .eq('board_id', id)
    .order('position')

  return NextResponse.json({ ...board, stages: stages ?? [] })
}

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as Partial<{ sub_items_source_board_id: string | null }>

  const supabase = createServiceClient()

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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('boards')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, sid, slug, name, type, system_key')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json(data)
}
