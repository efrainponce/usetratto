import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const service = createServiceClient()

  // Verify board belongs to workspace (service client bypasses RLS)
  const { data: board } = await service
    .from('boards')
    .select('id, workspace_id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get existing views
  const { data: views, error: viewsError } = await service
    .from('sub_item_views')
    .select('id, sid, name, position, type, config, created_at')
    .eq('board_id', id)
    .order('position')

  if (viewsError) return NextResponse.json({ error: viewsError.message }, { status: 500 })

  // Auto-create default native view if none exist
  if (!views || views.length === 0) {
    const { data: newView, error: createError } = await service
      .from('sub_item_views')
      .insert({
        board_id: id,
        workspace_id: auth.workspaceId,
        name: 'Sub-items',
        position: 0,
        type: 'native',
        config: {},
      })
      .select('id, sid, name, position, type, config, created_at')
      .single()

    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })
    return NextResponse.json(newView ? [newView] : [])
  }

  return NextResponse.json(views ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as {
    name?: string
    type?: string
    config?: Record<string, unknown>
    position?: number
  }

  // Validate name
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json(
      { error: 'Name must be a non-empty string' },
      { status: 400 }
    )
  }

  if (body.name.length > 100) {
    return NextResponse.json(
      { error: 'Name must be 100 characters or less' },
      { status: 400 }
    )
  }

  // Validate type
  const validTypes = ['native', 'board_items', 'board_sub_items']
  if (!body.type || !validTypes.includes(body.type)) {
    return NextResponse.json(
      { error: `Type must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  // Verify board belongs to workspace (service client bypasses RLS)
  const { data: board } = await service
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Get max position if not provided
  let position = body.position
  if (position === undefined) {
    const { data: lastView } = await service
      .from('sub_item_views')
      .select('position')
      .eq('board_id', id)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    position = (lastView?.position ?? -1) + 1
  }

  // Insert view
  const { data: view, error } = await service
    .from('sub_item_views')
    .insert({
      board_id: id,
      workspace_id: auth.workspaceId,
      name: body.name.trim(),
      type: body.type,
      config: body.config ?? {},
      position,
    })
    .select('id, sid, name, position, type, config, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(view, { status: 201 })
}
