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
    .from('board_columns')
    .select('id, col_key, name, kind, position, is_system, is_hidden, required, settings')
    .eq('board_id', id)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(columns ?? [])
}

export async function POST(req: Request, { params }: Context) {
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
    .maybeSingle()

  if (!board) return NextResponse.json({ error: 'Board no encontrado' }, { status: 404 })

  const body = await req.json() as {
    col_key?: string
    name?:    string
    kind?:    string
    settings?: Record<string, unknown>
  }

  const { name, kind } = body
  if (!name || !kind) {
    return NextResponse.json({ error: 'name and kind required' }, { status: 400 })
  }

  // Generate col_key from name if not provided; ensure uniqueness per board
  const baseKey = (body.col_key ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  let col_key   = baseKey
  let attempt   = 0
  while (true) {
    const { data: existing } = await supabase
      .from('board_columns')
      .select('id')
      .eq('board_id', id)
      .eq('col_key', col_key)
      .maybeSingle()
    if (!existing) break
    attempt++
    col_key = `${baseKey}_${attempt}`
  }

  // Get next position
  const { data: last } = await supabase
    .from('board_columns')
    .select('position')
    .eq('board_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (last?.position ?? -1) + 1

  const { data: column, error } = await supabase
    .from('board_columns')
    .insert({
      board_id:  id,
      col_key,
      name,
      kind,
      position,
      is_system: false,
      is_hidden: false,
      required:  false,
      settings:  body.settings ?? {},
    })
    .select('id, col_key, name, kind, position, is_system, is_hidden, required, settings')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(column, { status: 201 })
}
