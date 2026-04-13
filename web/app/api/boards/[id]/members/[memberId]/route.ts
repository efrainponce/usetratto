import { requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; memberId: string }> }

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, memberId } = await params
  const body = await req.json() as { access?: string; restrict_to_own?: boolean }

  if (body.access !== undefined && !['view', 'edit'].includes(body.access)) {
    return NextResponse.json(
      { error: "Access must be 'view' or 'edit'" },
      { status: 400 }
    )
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Verify member belongs to board
  const { data: member } = await supabase
    .from('board_members')
    .select('id')
    .eq('id', memberId)
    .eq('board_id', id)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Build patch — only update provided fields
  const patch: Record<string, unknown> = {}
  if (body.access !== undefined) patch.access = body.access
  if (body.restrict_to_own !== undefined) patch.restrict_to_own = body.restrict_to_own

  // Update member
  const { data: updated, error } = await supabase
    .from('board_members')
    .update(patch)
    .eq('id', memberId)
    .select(`
      id,
      access,
      user_id,
      team_id,
      users(id, sid, name),
      teams(id, sid, name)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
