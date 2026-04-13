import { requireAuthApi, requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('boards')
    .select('id, sid, slug, name, type, system_key')
    .eq('workspace_id', auth.workspaceId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const { name, type, description } = body

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  if (!type || !['pipeline', 'table'].includes(type)) {
    return NextResponse.json({ error: 'El tipo debe ser pipeline o table' }, { status: 400 })
  }

  // Generate slug: lowercase, spaces→hyphens, only alphanumeric+hyphen
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('boards')
    .insert({
      workspace_id: auth.workspaceId,
      name,
      type,
      description: description || null,
      slug,
    })
    .select('id, sid, slug, name, type, system_key')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
