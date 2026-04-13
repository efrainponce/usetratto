import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: itemId } = await params

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('item_activity')
    .select(
      'id, action, old_value, new_value, metadata, created_at, sub_item_id, users!item_activity_actor_id_fkey(id, name, phone)'
    )
    .eq('item_id', itemId)
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data ?? [] })
}
