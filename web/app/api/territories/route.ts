import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('territories')
    .select('id, sid, name, parent_id')
    .eq('workspace_id', auth.workspaceId)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const { name, parent_id } = body

  if (!name?.trim()) {
    return NextResponse.json(
      { error: 'Territory name is required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
