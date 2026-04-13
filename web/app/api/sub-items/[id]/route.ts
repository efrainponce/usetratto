import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as Partial<{
    name:       string
    qty:        number
    unit_price: number
    notes:      string | null
  }>

  const allowed = ['name', 'qty', 'unit_price', 'notes'] as const
  const patch: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) patch[k] = body[k]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('sub_items')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, sid, parent_id, depth, name, qty, unit_price, notes, catalog_item_id, position')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  // Cascade: also delete children (depth=1) before deleting parent
  await supabase
    .from('sub_items')
    .delete()
    .eq('parent_id', id)
    .eq('workspace_id', auth.workspaceId)

  const { error } = await supabase
    .from('sub_items')
    .delete()
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
