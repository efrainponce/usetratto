import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

async function verifySubItemOwnership(subItemId: string, workspaceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sub_items')
    .select('id')
    .eq('id', subItemId)
    .eq('workspace_id', workspaceId)
    .single()
  return !error && data
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const { paths } = await req.json() as { paths?: string[] }

  if (!Array.isArray(paths) || paths.length === 0) return jsonError('paths required', 400)
  if (paths.length > 200) return jsonError('too many paths (max 200)', 400)

  if (!await verifySubItemOwnership(id, auth.workspaceId)) {
    return jsonError('Sub-item not found', 404)
  }

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from('item-files')
    .createSignedUrls(paths, 3600)
  if (error) return jsonError(error.message, 500)

  const urls: Record<string, string | null> = {}
  for (const item of data ?? []) {
    urls[item.path ?? ''] = item.signedUrl ?? null
  }
  return NextResponse.json({ urls })
}
