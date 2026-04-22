import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

// Sanitize filename: replace spaces with _, keep only alphanumeric, dots, dashes, underscores
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._\-]/g, '')
}

// Verify item belongs to workspace
async function verifyItemOwnership(itemId: string, workspaceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
    .single()

  return !error && data
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const { column_id, filename, mime, size } = await req.json() as {
    column_id: string
    filename: string
    mime: string
    size: number
  }

  // Validate input
  if (!column_id || !filename || !mime || typeof size !== 'number') {
    return jsonError('Missing required fields', 400)
  }

  // Verify item ownership
  const isOwner = await verifyItemOwnership(id, auth.workspaceId)
  if (!isOwner) {
    return jsonError('Item not found', 404)
  }

  const sanitized = sanitizeFilename(filename)
  const path = `${auth.workspaceId}/${id}/${Date.now()}_${sanitized}`

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from('item-files')
    .createSignedUploadUrl(path)

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: data.path
  })
}

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const url = new URL(req.url)
  const path = url.searchParams.get('path')
  const column_id = url.searchParams.get('column_id')

  if (!path || !column_id) {
    return jsonError('Missing path or column_id', 400)
  }

  // Verify item ownership
  const isOwner = await verifyItemOwnership(id, auth.workspaceId)
  if (!isOwner) {
    return jsonError('Item not found', 404)
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from('item-files')
    .createSignedUrl(path, 3600)

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({
    url: data.signedUrl
  })
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const { column_id, path } = await req.json() as {
    column_id: string
    path: string
  }

  if (!column_id || !path) {
    return jsonError('Missing column_id or path', 400)
  }

  // Verify item ownership
  const isOwner = await verifyItemOwnership(id, auth.workspaceId)
  if (!isOwner) {
    return jsonError('Item not found', 404)
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.storage
    .from('item-files')
    .remove([path])

  if (error) {
    return jsonError(error.message, 500)
  }

  return new NextResponse(null, { status: 204 })
}
