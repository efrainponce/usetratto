import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: itemId } = await params

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('item_activity')
    .select(
      'id, action, old_value, new_value, metadata, created_at, sub_item_id, users!item_activity_actor_id_fkey(id, name, phone)'
    )
    .eq('item_id', itemId)
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ activity: data ?? [] })
}
