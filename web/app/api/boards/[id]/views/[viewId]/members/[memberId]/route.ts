import { requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; viewId: string; memberId: string }> }

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, viewId, memberId } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  // Delete member
  const { error } = await supabase
    .from('board_view_members')
    .delete()
    .eq('id', memberId)
    .eq('view_id', viewId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
