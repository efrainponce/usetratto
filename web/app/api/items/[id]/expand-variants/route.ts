import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

// POST /api/items/[id]/expand-variants
// Body: { use_tallas?: boolean, use_colores?: boolean }
// Calls the expand_catalog_variants RPC atomically.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = (await req.json().catch(() => ({}))) as {
    use_tallas?: boolean
    use_colores?: boolean
  }

  const supabase = await createClient()
  const { data: item } = await supabase
    .from('items')
    .select('id, board_id')
    .eq('id', itemId)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (!item) return jsonError('Item not found', 404)

  const { data: board } = await supabase
    .from('boards')
    .select('system_key')
    .eq('id', item.board_id)
    .maybeSingle()

  if (board?.system_key !== 'catalog') {
    return jsonError('Solo se pueden expandir variantes en items del Catálogo', 400)
  }

  const svc = createServiceClient()
  const { data, error } = await svc.rpc('expand_catalog_variants', {
    p_catalog_item_id: itemId,
    p_use_tallas:      body.use_tallas ?? true,
    p_use_colores:     body.use_colores ?? false,
  })

  if (error) return jsonError(error.message, 500)

  return NextResponse.json(data)
}
