import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk, verifyBoardAccess } from '@/lib/api-helpers'
import { createPermissionHandlers } from '@/lib/column-permissions-handler'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string; colId: string; permId: string }> }

const permissionHandlers = createPermissionHandlers('column_id')

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id, colId, permId } = await params
  const isAdmin = await requireBoardAdmin(id, auth.userId, auth.workspaceId, auth.role)
  if (!isAdmin) {
    return jsonError('Solo el admin del board puede realizar esta acción', 403)
  }

  const supabase = await createClient()

  // Verify board exists
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  return permissionHandlers.DELETE(supabase, colId, auth.workspaceId, permId)
}
