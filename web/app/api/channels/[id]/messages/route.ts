import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

const BUCKET = 'channel-attachments'
const SIGNED_URL_TTL = 60 * 60 // 1 hour

type IncomingAttachment = {
  file_path?: string
  file_name?: string
  mime_type?: string
  size_bytes?: number
}

async function signAttachments(attachments: Array<{ id: string; file_path: string; file_name: string; mime_type: string; size_bytes: number }>) {
  if (attachments.length === 0) return []
  const service = createServiceClient()
  return Promise.all(
    attachments.map(async a => {
      const { data } = await service.storage.from(BUCKET).createSignedUrl(a.file_path, SIGNED_URL_TTL)
      return { ...a, url: data?.signedUrl ?? null }
    })
  )
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: channelId } = await params
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
  const before = url.searchParams.get('before')

  const supabase = await createClient()

  let query = supabase
    .from('channel_messages')
    .select(
      'id, channel_id, user_id, body, type, metadata, created_at, users!channel_messages_user_id_fkey(id, name, phone), channel_message_attachments(id, file_path, file_name, mime_type, size_bytes)'
    )
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })

  if (before) {
    query = query.lt('created_at', before)
  }

  query = query.limit(limit)

  const { data, error } = await query

  if (error) return jsonError(error.message, 500)

  // Sign attachment URLs for each message
  const messages = await Promise.all(
    (data ?? []).reverse().map(async (m: any) => ({
      ...m,
      attachments: await signAttachments(m.channel_message_attachments ?? []),
      channel_message_attachments: undefined,
    }))
  )

  return NextResponse.json({ messages })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: channelId } = await params
  const body = await req.json()
  const { body: messageBody, attachments } = body as {
    body?: string
    attachments?: IncomingAttachment[]
  }

  const trimmedBody = (messageBody ?? '').trim()
  const validAttachments = (attachments ?? []).filter(
    a => a.file_path && a.file_name && a.mime_type && typeof a.size_bytes === 'number'
  )

  if (!trimmedBody && validAttachments.length === 0) {
    return jsonError('message body or attachments required', 400)
  }

  const supabase = await createClient()

  // Insert message
  const { data: message, error: insertError } = await supabase
    .from('channel_messages')
    .insert({
      workspace_id: auth.workspaceId,
      channel_id: channelId,
      user_id: auth.userId,
      body: trimmedBody,
      type: 'text',
    })
    .select('id, channel_id, user_id, body, type, metadata, created_at, users!channel_messages_user_id_fkey(id, name, phone)')
    .single()

  if (insertError) return jsonError(insertError.message, 500)

  // Insert attachment rows
  let attachmentRows: Array<{ id: string; file_path: string; file_name: string; mime_type: string; size_bytes: number }> = []
  if (validAttachments.length > 0 && message) {
    const { data: attRows, error: attError } = await supabase
      .from('channel_message_attachments')
      .insert(
        validAttachments.map(a => ({
          workspace_id: auth.workspaceId,
          message_id: message.id,
          file_path: a.file_path!,
          file_name: a.file_name!,
          mime_type: a.mime_type!,
          size_bytes: a.size_bytes!,
          uploaded_by: auth.userId,
        }))
      )
      .select('id, file_path, file_name, mime_type, size_bytes')

    if (attError) return jsonError(attError.message, 500)
    attachmentRows = attRows ?? []
  }

  // Parse @[Name](SID) mentions — resolve SID → UUID for mentions table
  const mentionRegex = /@\[([^\]]+)\]\(([0-9]+)\)/g
  let match
  const mentionedSids: number[] = []

  while ((match = mentionRegex.exec(trimmedBody)) !== null) {
    mentionedSids.push(Number(match[2]))
  }

  if (mentionedSids.length > 0 && message) {
    try {
      const { data: mentionedUsers } = await supabase
        .from('users')
        .select('id')
        .in('sid', mentionedSids)
        .eq('workspace_id', auth.workspaceId)

      if (mentionedUsers && mentionedUsers.length > 0) {
        await supabase.from('mentions').insert(
          mentionedUsers.map(u => ({
            workspace_id: auth.workspaceId,
            message_id: message.id,
            mentioned_user_id: u.id,
          }))
        )
      }
    } catch {
      // Silently ignore mention errors — don't fail the message send
    }
  }

  const signed = await signAttachments(attachmentRows)

  return NextResponse.json({ ...message, attachments: signed }, { status: 201 })
}
