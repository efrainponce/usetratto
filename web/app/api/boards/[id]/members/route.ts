import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { NextResponse } from 'next/server'
import { requireBoardAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk, verifyBoardAccess } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  const { data: members, error } = await supabase
    .from('board_members')
    .select(`
      id,
      access,
      restrict_to_own,
      user_id,
      team_id,
      users(id, sid, name),
      teams(id, sid, name)
    `)
    .eq('board_id', id)

  if (error) return jsonError(error.message, 500)
  return jsonOk(members ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const body = await req.json() as {
    user_id?: string
    team_id?: string
    access?: string
  }

  // Validate: exactly one of user_id or team_id
  const hasUserId = body.user_id && body.user_id.trim()
  const hasTeamId = body.team_id && body.team_id.trim()

  if ((hasUserId && hasTeamId) || (!hasUserId && !hasTeamId)) {
    return jsonError('Must specify exactly one of user_id or team_id', 400)
  }

  if (!body.access || !['view', 'edit'].includes(body.access)) {
    return jsonError("Access must be 'view' or 'edit'", 400)
  }

  const supabase = await createClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Insert member
  const { data: member, error } = await supabase
    .from('board_members')
    .insert({
      board_id: id,
      user_id: hasUserId ? body.user_id : null,
      team_id: hasTeamId ? body.team_id : null,
      access: body.access,
    })
    .select(`
      id,
      access,
      user_id,
      team_id,
      users(id, sid, name),
      teams(id, sid, name)
    `)
    .single()

  if (error) return jsonError(error.message, 500)
  return jsonOk(member, 201)
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const body = await req.json() as { member_id?: string }

  if (!body.member_id?.trim()) {
    return jsonError('member_id is required', 400)
  }

  const supabase = await createClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Delete member
  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('id', body.member_id)
    .eq('board_id', id)

  if (error) return jsonError(error.message, 500)
  return jsonOk({ success: true })
}
