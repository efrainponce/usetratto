import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('sub_items')
    .select('id, sid, parent_id, depth, name, qty, unit_price, notes, catalog_item_id, position')
    .eq('item_id', itemId)
    .eq('workspace_id', auth.workspaceId)
    .order('depth')
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await req.json()
  const {
    item_id,
    name,
    qty = 1,
    unit_price = 0,
    notes = null,
    parent_id = null,
    depth = 0,
    catalog_item_id = null,
  } = body as {
    item_id: string
    name: string
    qty?: number
    unit_price?: number
    notes?: string | null
    parent_id?: string | null
    depth?: number
    catalog_item_id?: string | null
  }

  if (!item_id || !name) {
    return NextResponse.json({ error: 'item_id and name required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get next position within same parent
  const { data: last } = await supabase
    .from('sub_items')
    .select('position')
    .eq('item_id', item_id)
    .eq('depth', depth)
    .eq(parent_id ? 'parent_id' : 'depth', parent_id ?? depth)  // group by parent
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (last?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('sub_items')
    .insert({
      workspace_id:    auth.workspaceId,
      item_id,
      parent_id,
      depth,
      name,
      qty,
      unit_price,
      notes,
      catalog_item_id,
      position,
    })
    .select('id, sid, parent_id, depth, name, qty, unit_price, notes, catalog_item_id, position')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
