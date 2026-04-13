'use client'

import { useEffect, useState } from 'react'

type Workspace = {
  id: string
  sid: number
  name: string
}

export default function WorkspaceSettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [name, setName] = useState('')

  // Fetch workspace on mount
  useEffect(() => {
    async function fetchWorkspace() {
      try {
        const res = await fetch('/api/workspace')
        const data = await res.json()
        if (res.ok) {
          setWorkspace(data)
          setName(data.name || '')
        }
      } catch (error) {
        console.error('Error fetching workspace:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkspace()
  }, [])

  // Auto-hide success message after 2s
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])

  async function handleSave() {
    if (!workspace) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()
      if (res.ok) {
        setWorkspace(data)
        setSaveSuccess(true)
      }
    } catch (error) {
      console.error('Error saving workspace:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Workspace</h1>
      <p className="text-sm text-gray-500 mb-8">Gestiona la configuración de tu workspace</p>

      {loading ? (
        <div className="space-y-6">
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
      ) : workspace ? (
        <>
          {/* General Section */}
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-gray-900 mb-6">General</h2>

            {/* Workspace Name Field */}
            <div className="flex items-start justify-between py-4 border-b border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Nombre</p>
                <p className="text-xs text-gray-500 mt-0.5">El nombre de tu workspace</p>
              </div>
              <div className="flex-1 flex justify-end">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-64 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  placeholder="Ej. Mi Workspace"
                />
              </div>
            </div>

            {/* Save Button & Success Message */}
            <div className="flex items-center justify-between pt-4">
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
          </div>

          {/* Danger Zone Section */}
          <div className="mt-12">
            <h2 className="text-sm font-semibold text-gray-900 mb-6">Zona de peligro</h2>

            <div className="border border-red-100 rounded-lg p-6 bg-red-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Eliminar workspace</p>
                  <p className="text-xs text-red-600 mt-0.5">Esta acción es irreversible</p>
                </div>
                <button
                  disabled
                  className="px-4 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50 cursor-not-allowed"
                  title="Contacta soporte para eliminar el workspace"
                >
                  Eliminar
                </button>
              </div>
              <p className="text-xs text-red-600 mt-3">
                Contacta soporte para eliminar el workspace
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-red-600">No se pudo cargar el workspace</p>
      )}
    </div>
  )
}
