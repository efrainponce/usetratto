import { NextResponse } from 'next/server'
import { requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError } from '@/lib/api-helpers'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const service = createServiceClient()

  // Scope delete by workspace_id to prevent cross-workspace deletes
  const { error } = await service
    .from('invitations')
    .delete()
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}
