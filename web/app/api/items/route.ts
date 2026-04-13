import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const boardId = new URL(req.url).searchParams.get('boardId')
  if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })

  const supabase = await createClient()

  // Check if this user has restrict_to_own for this board (non-admin members only)
  let restrictToOwn = false
  if (auth.role === 'member' || auth.role === 'viewer') {
    const { data: membership } = await supabase
      .from('board_members')
      .select('restrict_to_own')
      .eq('board_id', boardId)
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (membership?.restrict_to_own) restrictToOwn = true
  }

  let query = supabase
    .from('items')
    .select(
      'id, sid, name, stage_id, owner_id, territory_id, deadline, position,' +
      'item_values(column_id, value_text, value_number, value_date, value_json)'
    )
    .eq('board_id', boardId)
    .eq('workspace_id', auth.workspaceId)

  if (restrictToOwn) {
    query = query.eq('owner_id', auth.userId)
  }

  const { data, error } = await query.order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const { board_id, name } = body as { board_id?: string; name?: string }
  if (!board_id || !name) {
    return NextResponse.json({ error: 'board_id and name required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get next position
  const { data: last } = await supabase
    .from('items')
    .select('position')
    .eq('board_id', board_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (last?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('items')
    .insert({
      workspace_id: auth.workspaceId,
      board_id,
      name,
      owner_id: auth.userId,
      position,
    })
    .select('id, sid, name, stage_id, owner_id, territory_id, deadline, position')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
