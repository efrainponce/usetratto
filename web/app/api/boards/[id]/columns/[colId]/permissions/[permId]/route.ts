import { requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; colId: string; permId: string }> }

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id, colId, permId } = await params
  const supabase = await createClient()

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const { error } = await supabase
    .from('column_permissions')
    .delete()
    .eq('id', permId)
    .eq('column_id', colId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
