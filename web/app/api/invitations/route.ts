import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireAdminApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError } from '@/lib/api-helpers'

export async function POST(request: Request) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role

  // Validation
  if (!email || !email.includes('@')) {
    return jsonError('Email inválido', 400)
  }
  if (!['admin', 'member', 'viewer'].includes(role)) {
    return jsonError('Rol inválido', 400)
  }

  const service = createServiceClient()

  // Check no pending invitation for same email in this workspace
  const { data: existing } = await service
    .from('invitations')
    .select('id')
    .eq('workspace_id', auth.workspaceId)
    .eq('email', email)
    .is('accepted_at', null)
    .maybeSingle()

  if (existing) {
    return jsonError('Ya existe una invitación pendiente para este email', 409)
  }

  // Generate token: 32 URL-safe chars
  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Insert invitation row
  const { data: invitation, error: insertError } = await service
    .from('invitations')
    .insert({
      workspace_id: auth.workspaceId,
      email,
      role,
      token,
      expires_at: expiresAt,
      created_by: auth.userId,
    })
    .select('id, sid, email, role, token, expires_at, accepted_at, created_at')
    .single()

  if (insertError) {
    return jsonError(insertError.message, 500)
  }

  // Send email via Supabase Auth (built-in SMTP)
  const origin = new URL(request.url).origin
  const redirectTo = `${origin}/invite/${token}`

  // Fetch workspace name for email
  const { data: ws } = await service
    .from('workspaces')
    .select('name')
    .eq('id', auth.workspaceId)
    .maybeSingle()
  const workspaceName = ws?.name ?? 'Tratto'

  // Generate invite link via Supabase admin (no email sent — bypasses rate limit)
  const inviteData = { invitation_token: token, workspace_id: auth.workspaceId, role }

  let linkResult = await service.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: inviteData },
  })

  // If auth.users already has this email (stale from a previous revoked invite),
  // clean up the orphaned auth row and retry.
  if (linkResult.error?.message?.includes('already been registered')) {
    const { data: staleUser } = await service
      .from('users')
      .select('id, workspace_id')
      .eq('email', email)
      .maybeSingle()

    if (staleUser?.workspace_id) {
      await service.from('invitations').delete().eq('id', invitation.id)
      return jsonError('Este usuario ya tiene una cuenta activa', 409)
    }

    if (staleUser) {
      await service.auth.admin.deleteUser(staleUser.id)
    }

    linkResult = await service.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo, data: inviteData },
    })
  }

  if (linkResult.error || !linkResult.data?.properties?.action_link) {
    await service.from('invitations').delete().eq('id', invitation.id)
    return jsonError(`No se pudo generar la invitación: ${linkResult.error?.message ?? 'sin link'}`, 500)
  }

  // Send email via Resend (no Supabase rate limit)
  const actionLink = linkResult.data.properties.action_link
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: `Te invitaron a unirte a ${workspaceName} en Tratto`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #111; font-size: 20px;">Te invitaron a ${workspaceName}</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Haz click en el enlace para aceptar tu invitación y unirte al equipo.
          </p>
          <a href="${actionLink}"
             style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: #111; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
            Aceptar invitación
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            Este enlace expira en 7 días. Si no solicitaste esto, ignora este correo.
          </p>
        </div>
      `,
    }),
  })

  if (!resendRes.ok) {
    const resendErr = await resendRes.text()
    await service.from('invitations').delete().eq('id', invitation.id)
    return jsonError(`No se pudo enviar el email: ${resendErr}`, 500)
  }

  return NextResponse.json(invitation)
}

export async function GET(request: Request) {
  const auth = await requireAdminApi()
  if (isAuthError(auth)) return auth

  const service = createServiceClient()
  const { data, error } = await service
    .from('invitations')
    .select('id, sid, email, role, token, expires_at, accepted_at, created_at, created_by')
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false })

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ invitations: data ?? [] })
}
