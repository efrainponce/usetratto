import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { userCanAccessItem } from '@/lib/permissions'
import type { SubItemData } from '@/lib/boards/types'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  // Load the sub-item by id
  const { data: subItem, error: loadError } = await supabase
    .from('sub_items')
    .select('id, sid, depth, source_item_id, workspace_id, item_id')
    .eq('id', id)
    .single()

  if (loadError || !subItem) {
    return jsonError('Sub-item not found', 400)
  }

  // 16.13: Verify workspace_id matches
  if (subItem.workspace_id !== auth.workspaceId) {
    return jsonError('Not found', 404)
  }

  // 16.10: Verify item access
  const canAccess = await userCanAccessItem(subItem.item_id, auth.userId, auth.workspaceId, auth.role)
  if (!canAccess) {
    return jsonError('Forbidden', 403)
  }

  // Check if depth is 0 (L1)
  if (subItem.depth !== 0) {
    return jsonError('Solo sub-items de profundidad 0 pueden importar', 400)
  }

  // Check if source_item_id exists
  if (!subItem.source_item_id) {
    return jsonError('Sub-item sin fuente', 400)
  }

  // Load source item's sub-items (depth=0)
  const { data: sourceSubItems, error: sourceError } = await supabase
    .from('sub_items')
    .select('id, sid, name, position')
    .eq('item_id', subItem.source_item_id)
    .eq('depth', 0)
    .order('position', { ascending: true })

  if (sourceError) {
    return jsonError(sourceError.message, 500)
  }

  // If no source sub-items, return empty result
  if (!sourceSubItems || sourceSubItems.length === 0) {
    return NextResponse.json(
      {
        created: [],
        skipped: 0,
        message: 'El producto fuente no tiene sub-items',
      },
      { status: 201 }
    )
  }

  // Load existing L2 children (depth=1)
  const { data: existingL2, error: existingError } = await supabase
    .from('sub_items')
    .select('name')
    .eq('parent_id', id)
    .eq('depth', 1)

  if (existingError) {
    return jsonError(existingError.message, 500)
  }

  const existingNames = new Set(
    (existingL2 || []).map((item) => item.name)
  )

  // Filter source items that don't already exist
  const toCreate = sourceSubItems.filter(
    (item) => !existingNames.has(item.name)
  )

  if (toCreate.length === 0) {
    return NextResponse.json(
      {
        created: [],
        skipped: sourceSubItems.length,
      },
      { status: 201 }
    )
  }

  // Insert new L2 sub-items
  const createdItems: SubItemData[] = []
  for (let i = 0; i < toCreate.length; i++) {
    const sourceItem = toCreate[i]
    const { data: inserted, error: insertError } = await supabase
      .from('sub_items')
      .insert({
        workspace_id: subItem.workspace_id,
        item_id: subItem.item_id,
        parent_id: id,
        depth: 1,
        name: sourceItem.name,
        position: i,
      })
      .select('id, sid, parent_id, depth, name, source_item_id, position')
      .single()

    if (insertError) {
      return jsonError(insertError.message, 500)
    }

    if (inserted) {
      createdItems.push({
        ...inserted,
        values: [],
      })
    }
  }

  return NextResponse.json(
    {
      created: createdItems,
      skipped: sourceSubItems.length - toCreate.length,
    },
    { status: 201 }
  )
}
