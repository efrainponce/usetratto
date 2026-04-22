import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, sid, name')
    .eq('id', auth.workspaceId)
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const { name } = body

  if (!name || typeof name !== 'string') {
    return jsonError('El nombre es requerido', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', auth.workspaceId)
    .select('id, sid, name')
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data)
}
