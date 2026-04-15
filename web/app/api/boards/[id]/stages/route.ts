import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const svc = createServiceClient()

  // Verify board belongs to workspace
  const { data: board } = await svc
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: stages, error } = await svc
    .from('board_stages')
    .select('id, sid, name, color, position, is_closed')
    .eq('board_id', id)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(stages ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as { name?: string; color?: string }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: 'Stage name is required' },
      { status: 400 }
    )
  }

  if (!body.color?.trim()) {
    return NextResponse.json(
      { error: 'Stage color is required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get max position
  const { data: lastStage } = await supabase
    .from('board_stages')
    .select('position')
    .eq('board_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (lastStage?.position ?? -1) + 1

  const { data: stage, error } = await supabase
    .from('board_stages')
    .insert({
      board_id: id,
      name: body.name.trim(),
      color: body.color.trim(),
      position,
      is_closed: false,
    })
    .select('id, sid, name, color, position, is_closed')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(stage, { status: 201 })
}
