import { NextResponse } from 'next/server'
import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError } from '@/lib/api-helpers'

export async function POST(request: Request) {
  // User must be signed in (the magic link flow handles this)
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token) {
    return jsonError('Token requerido', 400)
  }

  // Get session user's email from Supabase auth (not our users table)
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser || !authUser.email) {
    return jsonError('Sesión sin email válido', 401)
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
    return jsonError('Invitación no encontrada', 404)
  }
  if (invitation.accepted_at) {
    return jsonError('Invitación ya aceptada', 410)
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return jsonError('Invitación expirada', 410)
  }
  if (invitation.email.toLowerCase() !== sessionEmail) {
    return jsonError('El email de la sesión no coincide con la invitación', 403)
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
    return jsonError(`No se pudo actualizar usuario: ${userError.message}`, 500)
  }

  // Mark invitation as accepted
  const { error: acceptError } = await service
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  if (acceptError) {
    return jsonError(acceptError.message, 500)
  }

  return NextResponse.json({ ok: true, workspace_id: invitation.workspace_id })
}
