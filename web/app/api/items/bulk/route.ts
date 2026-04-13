import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function DELETE(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await req.json() as { ids?: string[] }
  const { ids } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('items')
    .delete()
    .in('id', ids)
    .eq('workspace_id', auth.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
