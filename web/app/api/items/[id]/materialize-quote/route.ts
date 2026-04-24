import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

// POST /api/items/[id]/materialize-quote
// Creates a new item in the workspace's Cotizaciones board as an immutable
// snapshot of this opportunity's Catálogo sub-items. Returns the new quote
// item's id + sid so the client can navigate to it.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: oppItemId } = await params

  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  // Verify the user has access to the opp item (RLS-backed read)
  const supabase = await createClient()
  const { data: opp, error: oppErr } = await supabase
    .from('items')
    .select('id, workspace_id, board_id')
    .eq('id', oppItemId)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (oppErr) return jsonError(oppErr.message, 500)
  if (!opp) return jsonError('Oportunidad no encontrada', 404)

  const { data: board } = await supabase
    .from('boards')
    .select('system_key')
    .eq('id', opp.board_id)
    .maybeSingle()

  if (board?.system_key !== 'opportunities') {
    return jsonError('Solo se puede generar cotización desde una oportunidad', 400)
  }

  // Run the atomic RPC under the service client (the function itself is
  // SECURITY DEFINER; we gate access above via the user-scoped read).
  const svc = createServiceClient()
  const { data, error } = await svc.rpc('materialize_quote_from_opportunity', {
    p_opp_item_id: oppItemId,
    p_actor_id:    auth.userId,
  })

  if (error) return jsonError(error.message, 500)

  // Also return the quotes board sid so the client can navigate to the new item.
  const { data: quotesBoard } = await supabase
    .from('boards')
    .select('sid')
    .eq('workspace_id', auth.workspaceId)
    .eq('system_key', 'quotes')
    .maybeSingle()

  return NextResponse.json({
    quote: data,
    quotes_board_sid: quotesBoard?.sid ?? null,
  })
}
