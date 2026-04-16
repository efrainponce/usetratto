import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk, verifyBoardAccess, getNextPosition } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const svc = createServiceClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(svc, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  const { data: stages, error } = await svc
    .from('board_stages')
    .select('id, sid, name, color, position, is_closed')
    .eq('board_id', id)
    .order('position')

  if (error) return jsonError(error.message, 500)
  return jsonOk(stages ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const body = await req.json() as { name?: string; color?: string }

  if (!body.name?.trim()) {
    return jsonError('Stage name is required', 400)
  }

  if (!body.color?.trim()) {
    return jsonError('Stage color is required', 400)
  }

  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Get max position
  const position = await getNextPosition(supabase, 'board_stages', 'board_id', id)

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

  if (error) return jsonError(error.message, 500)
  return jsonOk(stage, 201)
}
