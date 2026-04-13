import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as { column_id: string }
  const { column_id } = body

  if (!column_id) {
    return NextResponse.json({ error: 'column_id required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify item belongs to workspace
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get column and verify it's a signature column
  const { data: col, error: colError } = await supabase
    .from('board_columns')
    .select('kind, settings')
    .eq('id', column_id)
    .single()

  if (colError || !col) {
    return NextResponse.json({ error: 'Column not found' }, { status: 404 })
  }

  if (col.kind !== 'signature') {
    return NextResponse.json({ error: 'Column is not a signature column' }, { status: 400 })
  }

  // Check if already signed (immutability)
  const { data: existingValue } = await supabase
    .from('item_values')
    .select('value_json')
    .eq('item_id', id)
    .eq('column_id', column_id)
    .single()

  if (existingValue?.value_json) {
    return NextResponse.json({ error: 'Ya firmado' }, { status: 409 })
  }

  // Verify role permissions if allowed_roles is set
  const settings = col.settings as Record<string, unknown> | null
  if (settings?.allowed_roles && Array.isArray(settings.allowed_roles) && settings.allowed_roles.length > 0) {
    if (!settings.allowed_roles.includes(auth.role)) {
      return NextResponse.json({ error: 'Rol no autorizado para firmar' }, { status: 403 })
    }
  }

  // Generate signature value
  const signatureValue = {
    doc_id: crypto.randomUUID(),
    signed_by: auth.name ?? 'Usuario',
    phone: auth.phone,
    signed_at: new Date().toISOString(),
    user_id: auth.userId,
  }

  // Upsert into item_values
  const { data, error } = await supabase
    .from('item_values')
    .upsert({
      item_id: id,
      column_id,
      value_text: null,
      value_number: null,
      value_date: null,
      value_json: signatureValue,
    }, { onConflict: 'item_id,column_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
