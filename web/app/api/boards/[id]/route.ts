import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { data: board, error } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (error || !board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: stages } = await supabase
    .from('board_stages')
    .select('id, name, color, position, is_closed')
    .eq('board_id', id)
    .order('position')

  return NextResponse.json({ ...board, stages: stages ?? [] })
}
