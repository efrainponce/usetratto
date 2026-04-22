import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

const BUCKET = 'channel-attachments'
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: channelId } = await params

  const supabase = await createClient()

  // Verify the caller can see this channel (RLS will filter private channels they're not in)
  const { data: channel, error: channelError } = await supabase
    .from('item_channels')
    .select('id, type')
    .eq('id', channelId)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (channelError) return jsonError(channelError.message, 500)
  if (!channel) return jsonError('Channel not found', 404)
  if (channel.type === 'system') return jsonError('Cannot attach files to system channel', 400)

  const formData = await req.formData().catch(() => null)
  if (!formData) return jsonError('multipart/form-data required', 400)

  const file = formData.get('file')
  if (!(file instanceof Blob)) return jsonError('file required', 400)

  const fileName = (file as File).name || 'archivo'
  const mimeType = file.type || 'application/octet-stream'
  const size = file.size

  if (size === 0) return jsonError('Empty file', 400)
  if (size > MAX_SIZE) return jsonError(`File exceeds ${MAX_SIZE / 1024 / 1024}MB limit`, 413)

  const service = createServiceClient()

  try {
    await service.storage.createBucket(BUCKET, { public: false })
  } catch {
    // Bucket likely already exists
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = fileName.replace(/[^\w.\-]+/g, '_').slice(0, 120)
  const filePath = `${auth.workspaceId}/${channelId}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: mimeType, upsert: false })

  if (uploadError) return jsonError(`Upload failed: ${uploadError.message}`, 500)

  return NextResponse.json({
    file_path: filePath,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: size,
  }, { status: 201 })
}
