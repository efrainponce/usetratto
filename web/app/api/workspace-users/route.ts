import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, sid, name, phone, role')
    .eq('workspace_id', auth.workspaceId)
    .order('name')

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data ?? [])
}
