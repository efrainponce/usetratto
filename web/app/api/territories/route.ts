import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('territories')
    .select('id, sid, name, parent_id')
    .eq('workspace_id', auth.workspaceId)
    .order('name')

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const { name, parent_id } = body

  if (!name?.trim()) {
    return jsonError('Territory name is required', 400)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('territories')
    .insert({
      name: name.trim(),
      parent_id: parent_id || null,
      workspace_id: auth.workspaceId,
    })
    .select('id, sid, name, parent_id')
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json(data, { status: 201 })
}
