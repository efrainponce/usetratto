import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk, verifyBoardAccess, getNextPosition } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const service = createServiceClient()

  // Verify board belongs to workspace (service client bypasses RLS)
  const verified = await verifyBoardAccess(service, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Get existing views
  const { data: views, error: viewsError } = await service
    .from('sub_item_views')
    .select('id, sid, name, position, type, config, created_at')
    .eq('board_id', id)
    .order('position')

  if (viewsError) return jsonError(viewsError.message, 500)

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

    if (createError) return jsonError(createError.message, 500)
    return jsonOk(newView ? [newView] : [])
  }

  return jsonOk(views ?? [])
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
    return jsonError('Name must be a non-empty string', 400)
  }

  if (body.name.length > 100) {
    return jsonError('Name must be 100 characters or less', 400)
  }

  // Validate type
  const validTypes = ['native', 'board_items', 'board_sub_items']
  if (!body.type || !validTypes.includes(body.type)) {
    return jsonError(`Type must be one of: ${validTypes.join(', ')}`, 400)
  }

  const service = createServiceClient()

  // Verify board belongs to workspace (service client bypasses RLS)
  const verified = await verifyBoardAccess(service, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Get max position if not provided
  let position = body.position
  if (position === undefined) {
    position = await getNextPosition(service, 'sub_item_views', 'board_id', id)
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

  if (error) return jsonError(error.message, 500)

  // Auto-inject system columns for native views
  if (view && view.type === 'native') {
    const systemCols = [
      { col_key: 'created_by', name: 'Creado por',           kind: 'people', position: 900, is_system: true, settings: { display: 'read_only' } },
      { col_key: 'created_at', name: 'Fecha de creación',    kind: 'date',   position: 901, is_system: true, settings: { display: 'relative', read_only: true } },
      { col_key: 'updated_at', name: 'Última modificación',  kind: 'date',   position: 902, is_system: true, settings: { display: 'relative', read_only: true } },
    ]

    for (const col of systemCols) {
      // Check if column already exists for this board+view combination
      const { data: existing } = await service
        .from('sub_item_columns')
        .select('id')
        .eq('board_id', id)
        .eq('view_id', view.id)
        .eq('col_key', col.col_key)
        .maybeSingle()

      // Only insert if doesn't exist
      if (!existing) {
        await service
          .from('sub_item_columns')
          .insert({
            board_id: id,
            view_id: view.id,
            ...col,
          })
          .maybeSingle()
      }
    }
  }

  return jsonOk(view, 201)
}
