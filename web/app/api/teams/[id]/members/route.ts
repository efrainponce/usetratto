import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await context.params

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_teams')
    .select('users(id, sid, name, role)')
    .eq('team_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const members = data
    .map((item: any) => item.users)
    .filter(Boolean)

  return NextResponse.json(members)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id } = await context.params
  const body = await request.json()
  const { userId } = body

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_teams')
    .insert({
      team_id: id,
      user_id: userId,
    })
    .select('users(id, sid, name, role)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'User already in team' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data.users, { status: 201 })
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id } = await context.params
  const body = await request.json()
  const { userId } = body

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('user_teams')
    .delete()
    .eq('team_id', id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
