import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { userCanEditColumn } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as { column_id: string; value: unknown }
  const { column_id, value } = body

  if (!column_id) return jsonError('column_id required', 400)

  const supabase = await createClient()

  // Verify sub_item belongs to workspace
  const { data: subItem } = await supabase
    .from('sub_items')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!subItem) return jsonError('Not found', 404)

  // Check edit permission for this column (sub_item_column)
  const canEdit = await userCanEditColumn(
    { type: 'sub_item', id: column_id },
    auth.userId,
    auth.workspaceId,
    auth.role
  )
  if (!canEdit) {
    return jsonError('No tienes permiso para editar esta columna', 403)
  }

  // Build upsert object
  const v = value
  const toUpsert = {
    sub_item_id: id,
    column_id,
    value_text: typeof v === 'string' ? v : null,
    value_number: typeof v === 'number' ? v : null,
    value_date: null,
    value_json: Array.isArray(v) || typeof v === 'boolean' ? v : null,
  }

  const { data, error } = await supabase
    .from('sub_item_values')
    .upsert(toUpsert, { onConflict: 'sub_item_id,column_id' })
    .select()
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data)
}
