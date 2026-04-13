import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: columns, error } = await supabase
    .from('sub_item_columns')
    .select('id, board_id, col_key, name, kind, position, is_hidden, required, settings, source_col_key')
    .eq('board_id', id)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(columns ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as {
    col_key: string
    name: string
    kind: string
    position?: number
    is_hidden?: boolean
    required?: boolean
    settings?: Record<string, unknown>
    source_col_key?: string | null
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

  // Get next position if not provided
  let position = body.position
  if (position === undefined) {
    const { data: last } = await supabase
      .from('sub_item_columns')
      .select('position')
      .eq('board_id', id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    position = (last?.position ?? -1) + 1
  }

  const { data, error } = await supabase
    .from('sub_item_columns')
    .insert({
      board_id: id,
      col_key: body.col_key,
      name: body.name,
      kind: body.kind,
      position,
      is_hidden: body.is_hidden ?? false,
      required: body.required ?? false,
      settings: body.settings ?? {},
      source_col_key: body.source_col_key ?? null,
    })
    .select('id, board_id, col_key, name, kind, position, is_hidden, required, settings, source_col_key')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
