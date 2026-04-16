import { NextResponse } from 'next/server'
import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  // User must be signed in (the magic link flow handles this)
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  // Get session user's email from Supabase auth (not our users table)
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser || !authUser.email) {
    return NextResponse.json({ error: 'Sesión sin email válido' }, { status: 401 })
  }
  const sessionEmail = authUser.email.toLowerCase()

  const service = createServiceClient()

  // Fetch invitation
  const { data: invitation, error: fetchError } = await service
    .from('invitations')
    .select('id, workspace_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (fetchError || !invitation) {
    return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
  }
  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'Invitación ya aceptada' }, { status: 410 })
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 })
  }
  if (invitation.email.toLowerCase() !== sessionEmail) {
    return NextResponse.json({ error: 'El email de la sesión no coincide con la invitación' }, { status: 403 })
  }

  // Provision user row: set workspace_id + role from invitation
  const { error: userError } = await service
    .from('users')
    .update({
      workspace_id: invitation.workspace_id,
      role: invitation.role,
      email: invitation.email,
    })
    .eq('id', auth.userId)

  if (userError) {
    return NextResponse.json({ error: `No se pudo actualizar usuario: ${userError.message}` }, { status: 500 })
  }

  // Mark invitation as accepted
  const { error: acceptError } = await service
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  if (acceptError) {
    return NextResponse.json({ error: acceptError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, workspace_id: invitation.workspace_id })
}
