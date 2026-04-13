import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
      'id, channel_id, user_id, body, type, metadata, created_at, users!channel_messages_user_id_fkey(id, name, phone)'
    )
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })

  if (before) {
    query = query.lt('created_at', before)
  }

  query = query.limit(limit)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reverse to ascending order for response
  const messages = (data ?? []).reverse()
  return NextResponse.json({ messages })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: channelId } = await params
  const body = await req.json()
  const { body: messageBody } = body as { body?: string }

  if (!messageBody) {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Insert message
  const { data: message, error: insertError } = await supabase
    .from('channel_messages')
    .insert({
      workspace_id: auth.workspaceId,
      channel_id: channelId,
      user_id: auth.userId,
      body: messageBody,
      type: 'text',
    })
    .select('id, channel_id, user_id, body, type, metadata, created_at, users!channel_messages_user_id_fkey(id, name, phone)')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Parse @[Name](SID) mentions — resolve SID → UUID for mentions table
  const mentionRegex = /@\[([^\]]+)\]\(([0-9]+)\)/g
  let match
  const mentionedSids: number[] = []

  while ((match = mentionRegex.exec(messageBody)) !== null) {
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

  return NextResponse.json(message, { status: 201 })
}
