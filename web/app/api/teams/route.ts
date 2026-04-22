import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('teams')
    .select('id, sid, name, user_teams(count)')
    .eq('workspace_id', auth.workspaceId)
    .order('name')

  if (error) {
    return jsonError(error.message, 500)
  }

  const teams = data.map((team: any) => ({
    id: team.id,
    sid: team.sid,
    name: team.name,
    member_count: team.user_teams?.[0]?.count || 0,
  }))

  return NextResponse.json(teams)
}

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const { name } = body

  if (!name?.trim()) {
    return jsonError('Team name is required', 400)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('teams')
    .insert({
      name: name.trim(),
      workspace_id: auth.workspaceId,
    })
    .select('id, sid, name')
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json(data, { status: 201 })
}
