import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

function sanitizeFilename(filename: string): string {
  return filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '')
}

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
  const { column_id, filename, mime, size, thumb_filename } = await req.json() as {
    column_id: string
    filename: string
    mime: string
    size: number
    thumb_filename?: string
  }

  if (!column_id || !filename || !mime || typeof size !== 'number') {
    return jsonError('Missing required fields', 400)
  }

  if (!await verifySubItemOwnership(id, auth.workspaceId)) {
    return jsonError('Sub-item not found', 404)
  }

  const sanitized = sanitizeFilename(filename)
  const stamp = Date.now()
  const path = `${auth.workspaceId}/sub-items/${id}/${stamp}_${sanitized}`

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from('item-files')
    .createSignedUploadUrl(path)
  if (error) return jsonError(error.message, 500)

  let thumbSignedUrl: string | undefined
  let thumbPath: string | undefined
  if (thumb_filename) {
    const sanitizedThumb = sanitizeFilename(thumb_filename)
    const tPath = `${auth.workspaceId}/sub-items/${id}/thumbs/${stamp}_${sanitizedThumb}`
    const { data: tData, error: tError } = await service.storage
      .from('item-files')
      .createSignedUploadUrl(tPath)
    if (tError) return jsonError(tError.message, 500)
    thumbSignedUrl = tData.signedUrl
    thumbPath = tData.path
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: data.path,
    thumbSignedUrl,
    thumbPath,
  })
}

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const url = new URL(req.url)
  const path = url.searchParams.get('path')
  const column_id = url.searchParams.get('column_id')

  if (!path || !column_id) return jsonError('Missing path or column_id', 400)
  if (!await verifySubItemOwnership(id, auth.workspaceId)) {
    return jsonError('Sub-item not found', 404)
  }

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from('item-files')
    .createSignedUrl(path, 3600)
  if (error) return jsonError(error.message, 500)

  return NextResponse.json({ url: data.signedUrl })
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const { column_id, path, thumb_path } = await req.json() as {
    column_id: string
    path: string
    thumb_path?: string
  }

  if (!column_id || !path) return jsonError('Missing column_id or path', 400)
  if (!await verifySubItemOwnership(id, auth.workspaceId)) {
    return jsonError('Sub-item not found', 404)
  }

  const targets = thumb_path ? [path, thumb_path] : [path]
  const service = createServiceClient()
  const { error } = await service.storage.from('item-files').remove(targets)
  if (error) return jsonError(error.message, 500)

  return new NextResponse(null, { status: 204 })
}
