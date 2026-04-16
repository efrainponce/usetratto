import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk, verifyBoardAccess, getNextPosition } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const viewId = new URL(req.url).searchParams.get('viewId')
  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  let query = supabase
    .from('sub_item_columns')
    .select('id, board_id, col_key, name, kind, position, is_hidden, required, is_system, settings, source_col_key')
    .eq('board_id', id)
    .order('position')

  if (viewId) query = query.eq('view_id', viewId)

  const { data: columns, error } = await query

  if (error) return jsonError(error.message, 500)
  return jsonOk(columns ?? [])
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
    is_system?: boolean
    settings?: Record<string, unknown>
    source_col_key?: string | null
    view_id?: string | null
  }

  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Get next position if not provided
  let position = body.position
  if (position === undefined) {
    position = await getNextPosition(supabase, 'sub_item_columns', 'board_id', id)
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
      is_system: body.is_system ?? false,
      settings: body.settings ?? {},
      source_col_key: body.source_col_key ?? null,
      view_id: body.view_id ?? null,
    })
    .select('id, board_id, col_key, name, kind, position, is_hidden, required, is_system, settings, source_col_key')
    .single()

  if (error) return jsonError(error.message, 500)
  return jsonOk(data, 201)
}
