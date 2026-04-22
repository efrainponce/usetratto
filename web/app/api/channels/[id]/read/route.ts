import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id: channelId } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('channel_reads')
    .upsert(
      {
        user_id: auth.userId,
        channel_id: channelId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,channel_id' }
    )

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}
