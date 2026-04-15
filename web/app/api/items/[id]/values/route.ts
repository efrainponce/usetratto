import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { userCanEditColumn } from '@/lib/permissions'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  // Verify item belongs to workspace
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('item_values')
    .select('column_id, value_text, value_number, value_date, value_json')
    .eq('item_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PUT(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as { column_id: string; value: unknown }
  const { column_id, value } = body

  if (!column_id) return NextResponse.json({ error: 'column_id required' }, { status: 400 })

  const supabase = await createClient()

  // Verify item belongs to workspace
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check edit permission for this column
  const canEdit = await userCanEditColumn(
    { type: 'board', id: column_id },
    auth.userId,
    auth.workspaceId,
    auth.role
  )
  if (!canEdit) {
    return NextResponse.json({ error: 'No tienes permiso para editar esta columna' }, { status: 403 })
  }

  // Determine column kind for correct typed field
  const { data: col } = await supabase
    .from('board_columns')
    .select('kind')
    .eq('id', column_id)
    .single()

  const upsert: Record<string, unknown> = {
    item_id:      id,
    column_id,
    value_text:   null,
    value_number: null,
    value_date:   null,
    value_json:   null,
  }

  const kind = col?.kind ?? 'text'

  // signature is immutable — use /api/items/[id]/signature instead
  if (kind === 'signature') {
    return NextResponse.json(
      { error: 'Use /api/items/[id]/signature para firmar' },
      { status: 400 }
    )
  }

  if (value !== null && value !== undefined) {
    if (kind === 'number') {
      upsert.value_number = typeof value === 'number' ? value : parseFloat(String(value))
    } else if (kind === 'date') {
      upsert.value_date = String(value)
    } else if (kind === 'boolean' || kind === 'multiselect' || kind === 'file') {
      upsert.value_json = value
    } else {
      upsert.value_text = String(value)
    }
  }

  const { data, error } = await supabase
    .from('item_values')
    .upsert(upsert, { onConflict: 'item_id,column_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
