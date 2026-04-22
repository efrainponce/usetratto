import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as Partial<{ name: string }>

  const allowed = ['name'] as const
  const patch: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) patch[k] = body[k]
  }

  if (Object.keys(patch).length === 0) {
    return jsonError('nothing to update', 400)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sub_items')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, sid, parent_id, depth, name, source_item_id, position')
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  // Cascade: also delete children (depth=1) before deleting parent
  await supabase
    .from('sub_items')
    .delete()
    .eq('parent_id', id)
    .eq('workspace_id', auth.workspaceId)

  const { error } = await supabase
    .from('sub_items')
    .delete()
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)

  if (error) return jsonError(error.message, 500)
  return new NextResponse(null, { status: 204 })
}
