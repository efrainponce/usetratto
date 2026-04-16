import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { InviteLanding } from './InviteLanding'

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ code?: string }>
}

export const dynamic = 'force-dynamic'

export default async function InvitePage({ params, searchParams }: Props) {
  const { token } = await params
  const { code } = await searchParams

  const service = createServiceClient()

  // Fetch invitation + workspace name (public lookup by token, RLS bypassed)
  const { data: invitation } = await service
    .from('invitations')
    .select('id, email, role, expires_at, accepted_at, workspace_id')
    .eq('token', token)
    .maybeSingle()

  if (!invitation) {
    return (
      <ErrorScreen
        title="Invitación no encontrada"
        message="El enlace es inválido o ya fue usado."
      />
    )
  }

  if (invitation.accepted_at) {
    return (
      <ErrorScreen
        title="Invitación ya aceptada"
        message="Esta invitación ya fue usada. Inicia sesión para acceder al workspace."
        cta={{ label: 'Ir a iniciar sesión', href: '/login' }}
      />
    )
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <ErrorScreen
        title="Invitación expirada"
        message="Pide al administrador que te envíe una nueva invitación."
      />
    )
  }

  // Fetch workspace name for display
  const { data: workspace } = await service
    .from('workspaces')
    .select('name')
    .eq('id', invitation.workspace_id)
    .maybeSingle()

  return (
    <InviteLanding
      token={token}
      code={code ?? null}
      email={invitation.email}
      role={invitation.role}
      workspaceName={workspace?.name ?? 'Tratto'}
    />
  )
}

function ErrorScreen({
  title,
  message,
  cta,
}: {
  title: string
  message: string
  cta?: { label: string; href: string }
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        {cta && (
          <a
            href={cta.href}
            className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition"
          >
            {cta.label}
          </a>
        )}
      </div>
    </main>
  )
}
