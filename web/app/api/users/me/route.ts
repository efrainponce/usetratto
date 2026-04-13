import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, sid, name, phone, job_title, role')
    .eq('id', auth.userId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const { name, job_title } = body

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .update({
      ...(name !== undefined && { name }),
      ...(job_title !== undefined && { job_title }),
    })
    .eq('id', auth.userId)
    .select('id, sid, name, phone, job_title, role')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
