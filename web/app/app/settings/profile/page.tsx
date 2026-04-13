'use client'

import { useEffect, useState } from 'react'

type UserProfile = {
  id: string
  sid: number
  name: string | null
  phone: string | null
  job_title: string | null
  role: 'superadmin' | 'admin' | 'member' | 'viewer'
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  // Fetch profile on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/users/me')
        const data = await res.json()
        if (res.ok) {
          setProfile(data)
          setName(data.name || '')
          setJobTitle(data.job_title || '')
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  // Auto-hide success message after 2s
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])

  async function handleSave() {
    if (!profile) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, job_title: jobTitle }),
      })

      const data = await res.json()
      if (res.ok) {
        setProfile(data)
        setSaveSuccess(true)
      }
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Avatar color determinism based on name
  const getAvatarColor = (fullName: string | null) => {
    const colors = [
      'bg-indigo-100 text-indigo-700',
      'bg-violet-100 text-violet-700',
      'bg-rose-100 text-rose-700',
      'bg-amber-100 text-amber-700',
      'bg-teal-100 text-teal-700',
      'bg-sky-100 text-sky-700',
    ]
    if (!fullName || fullName.length === 0) return colors[0]
    return colors[fullName.charCodeAt(0) % colors.length]
  }

  // Get avatar initial
  const getInitial = (fullName: string | null) => {
    return fullName ? fullName.charAt(0).toUpperCase() : 'U'
  }

  // Role badge styling
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-700'
      case 'admin':
        return 'bg-blue-100 text-blue-700'
      case 'member':
        return 'bg-gray-100 text-gray-700'
      case 'viewer':
        return 'bg-gray-50 text-gray-600'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  // Role label in Spanish
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'Superadministrador'
      case 'admin':
        return 'Administrador'
      case 'member':
        return 'Miembro'
      case 'viewer':
        return 'Visualizador'
      default:
        return role
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Perfil</h1>
      <p className="text-sm text-gray-500 mb-8">Administra la información de tu cuenta</p>

      {loading ? (
        <div className="space-y-6">
          <div className="flex items-start justify-between py-4">
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-48" />
            </div>
            <div className="h-16 w-16 bg-gray-200 rounded-full" />
          </div>

          {[1, 2].map((i) => (
            <div key={i} className="flex items-start justify-between py-4">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-40" />
              </div>
              <div className="h-8 bg-gray-200 rounded w-48" />
            </div>
          ))}
        </div>
      ) : profile ? (
        <>
          {/* Avatar Section */}
          <div className="flex items-start justify-between py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Foto de perfil</p>
              <p className="text-xs text-gray-500 mt-0.5">El cambio se verá en toda la app</p>
            </div>
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold ${getAvatarColor(
                profile.name
              )}`}
            >
              {getInitial(profile.name)}
            </div>
          </div>

          <div className="border-t border-gray-100 my-6" />

          {/* Name Field */}
          <div className="flex items-start justify-between py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Nombre completo</p>
              <p className="text-xs text-gray-500 mt-0.5">Tu nombre aparecerá en la aplicación</p>
            </div>
            <div className="flex-1 flex justify-end">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-64 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="Ej. Juan Pérez"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 my-6" />

          {/* Job Title Field */}
          <div className="flex items-start justify-between py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Cargo</p>
              <p className="text-xs text-gray-500 mt-0.5">Tu posición en la organización</p>
            </div>
            <div className="flex-1 flex justify-end">
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-64 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                placeholder="Ej. Director Comercial"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 my-6" />

          {/* Phone (Read-only) */}
          <div className="flex items-start justify-between py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Teléfono</p>
              <p className="text-xs text-gray-500 mt-0.5">No se puede cambiar</p>
            </div>
            <div className="flex-1 flex justify-end">
              <p className="text-sm text-gray-600 text-right">
                {profile.phone || '—'}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 my-6" />

          {/* Role (Read-only) */}
          <div className="flex items-start justify-between py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Rol</p>
              <p className="text-xs text-gray-500 mt-0.5">Tu nivel de acceso</p>
            </div>
            <div className="flex-1 flex justify-end">
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                  profile.role
                )}`}
              >
                {getRoleLabel(profile.role)}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 my-6" />

          {/* Save Button & Success Message */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>

            {saveSuccess && (
              <p className="text-xs text-green-600 font-medium">
                Guardado ✓
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-red-600">No se pudo cargar el perfil</p>
      )}
    </div>
  )
}
