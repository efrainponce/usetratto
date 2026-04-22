import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { ProfileForm } from './ProfileForm'

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
]

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-purple-100 text-purple-700',
  admin:      'bg-blue-100 text-blue-700',
  member:     'bg-gray-100 text-gray-700',
  viewer:     'bg-gray-50 text-gray-600',
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Superadministrador',
  admin:      'Administrador',
  member:     'Miembro',
  viewer:     'Visualizador',
}

export default async function ProfileSettingsPage() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) redirect('/login')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('users')
    .select('id, sid, name, phone, job_title, role')
    .eq('id', auth.userId)
    .single()

  if (!profile) return <p className="text-sm text-red-600">No se pudo cargar el perfil</p>

  const initial = profile.name?.charAt(0).toUpperCase() ?? 'U'
  const color   = AVATAR_COLORS[(profile.name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
  const badge   = ROLE_BADGE[profile.role] ?? ROLE_BADGE.member
  const label   = ROLE_LABEL[profile.role] ?? profile.role

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Perfil</h1>
      <p className="text-sm text-gray-500 mb-8">Administra la información de tu cuenta</p>

      <div className="flex items-start justify-between py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">Foto de perfil</p>
          <p className="text-xs text-gray-500 mt-0.5">El cambio se verá en toda la app</p>
        </div>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold ${color}`}>
          {initial}
        </div>
      </div>

      <div className="border-t border-gray-100 my-6" />

      <ProfileForm initialName={profile.name ?? ''} initialJobTitle={profile.job_title ?? ''} />

      <div className="border-t border-gray-100 my-6" />

      <div className="flex items-start justify-between py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">Teléfono</p>
          <p className="text-xs text-gray-500 mt-0.5">No se puede cambiar</p>
        </div>
        <div className="flex-1 flex justify-end">
          <p className="text-sm text-gray-600 text-right">{profile.phone || '—'}</p>
        </div>
      </div>

      <div className="border-t border-gray-100 my-6" />

      <div className="flex items-start justify-between py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">Rol</p>
          <p className="text-xs text-gray-500 mt-0.5">Tu nivel de acceso</p>
        </div>
        <div className="flex-1 flex justify-end">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${badge}`}>
            {label}
          </div>
        </div>
      </div>
    </div>
  )
}
