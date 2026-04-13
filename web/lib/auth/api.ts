import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export type UserRole = 'superadmin' | 'admin' | 'member' | 'viewer'

export type AuthUser = {
  userId: string
  userSid: number
  phone: string | null
  name: string | null
  role: UserRole
  workspaceId: string
}

export async function requireAuthApi(): Promise<AuthUser | NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('users')
    .select('sid, name, role, workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 })
  }

  return {
    userId: user.id,
    userSid: profile.sid,
    phone: user.phone ?? null,
    name: profile.name,
    role: profile.role as UserRole,
    workspaceId: profile.workspace_id,
  }
}

export async function requireAdminApi(): Promise<AuthUser | NextResponse> {
  const result = await requireAuthApi()
  if (result instanceof NextResponse) return result

  if (result.role !== 'admin' && result.role !== 'superadmin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  return result
}

export function isAuthError(result: AuthUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
