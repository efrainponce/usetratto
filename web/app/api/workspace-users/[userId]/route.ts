import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ userId: string }> }

// superadmin is platform-only — workspace admins cannot assign it
const ALLOWED_ROLES = ['admin', 'member', 'viewer'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]

export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { userId } = await params
  const body = await req.json() as { role?: string }

  if (!body.role || !ALLOWED_ROLES.includes(body.role as AllowedRole)) {
    return NextResponse.json({ error: 'role must be one of: admin, member, viewer' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify target user is in same workspace
  const { data: target } = await service
    .from('users')
    .select('id, workspace_id')
    .eq('id', userId)
    .single()

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.workspace_id !== auth.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Admin/superadmin can always change roles
  const isAdminOrAbove = auth.role === 'admin' || auth.role === 'superadmin'

  if (!isAdminOrAbove) {
    // Bootstrap: allow self-promotion to admin ONLY if the workspace has no admins yet
    const isSelf = userId === auth.userId
    if (!isSelf || body.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { count } = await service
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', auth.workspaceId)
      .in('role', ['admin', 'superadmin'])

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }
    // No admins in workspace → allow bootstrap self-promotion
  }

  const { data: updated, error } = await service
    .from('users')
    .update({ role: body.role })
    .eq('id', userId)
    .select('id, sid, name, phone, role')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
