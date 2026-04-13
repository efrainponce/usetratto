import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key')
    .eq('workspace_id', auth.workspaceId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
